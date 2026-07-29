import { createHash, randomBytes } from 'node:crypto'
import {
  chmod,
  link,
  mkdir,
  readdir,
  readFile,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const allowedKinds = new Set(['pr', 'issue'])
const allowedArchiveOutcomes = new Set(['abandoned', 'reconciled'])
const pathSegmentPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export class HandoffError extends Error {
  constructor(codeName, message, options = {}) {
    super(message)
    this.name = 'HandoffError'
    this.codeName = codeName
    this.details = options.details ?? null
    this.exitCode = options.exitCode ?? 2
  }
}

const getNow = (options) => options.now ?? new Date()

const assertDate = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new HandoffError('USAGE', 'now must be a valid Date', { exitCode: 1 })
  }
  return value
}

const normalizePathSegment = (value, label) => {
  const normalized = String(value ?? '').trim()
  if (!pathSegmentPattern.test(normalized)) {
    throw new HandoffError(
      'USAGE',
      `${label} is required and may contain only letters, digits, dots, underscores, and dashes`,
      { exitCode: 1 },
    )
  }
  return normalized
}

const normalizeKind = (value) => {
  if (!allowedKinds.has(value)) {
    throw new HandoffError('USAGE', '--kind must be pr or issue', {
      exitCode: 1,
    })
  }
  return value
}

const normalizeText = (value, label, { optional = false } = {}) => {
  if (value === undefined || value === null) {
    if (optional) {
      return null
    }
    throw new HandoffError('USAGE', `${label} is required`, { exitCode: 1 })
  }

  const normalized = String(value).trim()
  if (!normalized || normalized.includes('\u0000')) {
    throw new HandoffError('USAGE', `${label} must be non-empty plain text`, {
      exitCode: 1,
    })
  }
  return normalized
}

const normalizeAbsolutePath = (value, label, { optional = false } = {}) => {
  if (value === undefined || value === null || value === '') {
    if (optional) {
      return null
    }
    throw new HandoffError('USAGE', `${label} is required`, { exitCode: 1 })
  }

  const normalized = String(value).trim()
  if (!path.isAbsolute(normalized) || normalized.includes('\u0000')) {
    throw new HandoffError('USAGE', `${label} must be an absolute path`, {
      exitCode: 1,
    })
  }
  return normalized
}

const normalizeOptionalBranch = (value) => {
  if (value === undefined || value === null || value === '') {
    return null
  }
  return normalizeText(value, '--branch')
}

const normalizePathList = (values) => {
  if (values === undefined || values === null) {
    return []
  }

  if (!Array.isArray(values)) {
    throw new HandoffError(
      'USAGE',
      '--sidecar may be provided more than once',
      {
        exitCode: 1,
      },
    )
  }

  return [
    ...new Set(
      values.map((value) => normalizeAbsolutePath(value, '--sidecar')),
    ),
  ]
}

export const getDefaultHandoffRoot = (automationId, env = process.env) => {
  const normalizedAutomationId = normalizePathSegment(
    automationId,
    '--automation-id',
  )
  const configuredRoot = env.SPACE_WEB_GAME_HANDOFF_ROOT
  if (configuredRoot) {
    return normalizeAbsolutePath(configuredRoot, 'SPACE_WEB_GAME_HANDOFF_ROOT')
  }

  const codexHome = env.CODEX_HOME || path.join(homedir(), '.codex')
  return path.join(codexHome, 'automations', normalizedAutomationId, 'handoffs')
}

const getPaths = (options) => {
  const automationId = normalizePathSegment(
    options.automationId,
    '--automation-id',
  )
  const kind = normalizeKind(options.kind)
  const id = normalizePathSegment(options.id, '--id')
  const handoffRoot = normalizeAbsolutePath(
    options.handoffRoot || getDefaultHandoffRoot(automationId, options.env),
    '--root',
  )
  const handoffId = `${kind}-${id}`

  return {
    archiveRoot: path.join(handoffRoot, 'completed'),
    automationId,
    handoffId,
    handoffRoot,
    id,
    kind,
    pendingFile: path.join(handoffRoot, 'pending', `${handoffId}.json`),
    pendingRoot: path.join(handoffRoot, 'pending'),
  }
}

const createTempPath = (targetPath) =>
  path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.${randomBytes(6).toString('hex')}.tmp`,
  )

const writeJson = async (filePath, payload) => {
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, {
    mode: 0o600,
  })
  await chmod(filePath, 0o600).catch(() => {})
}

const createJsonAtomically = async (filePath, payload) => {
  const tempPath = createTempPath(filePath)
  await writeJson(tempPath, payload)

  try {
    await link(tempPath, filePath)
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new HandoffError(
        'HANDOFF_ACTIVE',
        `A pending handoff already exists: ${filePath}`,
      )
    }
    throw new HandoffError(
      'HANDOFF_WRITE_FAILED',
      `Could not create handoff record: ${filePath}`,
      { details: { cause: error?.message } },
    )
  } finally {
    await unlink(tempPath).catch(() => {})
  }

  await chmod(filePath, 0o600).catch(() => {})
}

const readJson = async (filePath, missingCodeName = 'HANDOFF_NOT_FOUND') => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new HandoffError(
        missingCodeName,
        `Handoff record not found: ${filePath}`,
      )
    }
    if (error instanceof SyntaxError) {
      throw new HandoffError(
        'HANDOFF_INVALID',
        `Handoff record is not valid JSON: ${filePath}`,
      )
    }
    throw new HandoffError(
      'HANDOFF_UNREADABLE',
      `Handoff record cannot be read safely: ${filePath}`,
      { details: { cause: error?.message } },
    )
  }
}

const assertRecord = (record, paths, { allowArchived = false } = {}) => {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new HandoffError(
      'HANDOFF_INVALID',
      'Handoff record must be an object',
    )
  }

  if (record.version !== 1) {
    throw new HandoffError(
      'HANDOFF_INVALID',
      'Handoff record has an unknown version',
    )
  }
  if (record.automation_id !== paths.automationId) {
    throw new HandoffError(
      'HANDOFF_INVALID',
      'Handoff automation identity does not match its storage root',
    )
  }
  if (record.handoff_id !== paths.handoffId) {
    throw new HandoffError(
      'HANDOFF_INVALID',
      'Handoff task identity does not match its file name',
    )
  }
  if (!record.claim || typeof record.claim !== 'object') {
    throw new HandoffError(
      'HANDOFF_INVALID',
      'Handoff claim metadata is missing',
    )
  }
  if (
    record.claim.kind !== paths.kind ||
    String(record.claim.id) !== paths.id
  ) {
    throw new HandoffError(
      'HANDOFF_INVALID',
      'Handoff claim kind/id does not match its file name',
    )
  }

  const branch = normalizeOptionalBranch(record.claim.branch)
  const tokenFile = normalizeAbsolutePath(
    record.claim.token_file,
    'claim token file',
  )
  const workerId = normalizeText(record.worker_thread_id, 'worker thread id')
  const worktreePath = normalizeAbsolutePath(
    record.worktree_path,
    'worktree path',
  )
  const nextAction = normalizeText(
    record.next_reconciliation_action,
    'next reconciliation action',
  )
  const scope = normalizeText(record.scope, 'scope')
  const parentThreadId = normalizeText(
    record.parent_thread_id,
    'parent thread id',
    {
      optional: true,
    },
  )
  const originalRunId = normalizeText(
    record.original_run_id,
    'original run id',
    {
      optional: true,
    },
  )
  const taskUrl = normalizeText(record.task_url, 'task URL', { optional: true })
  const sidecarPaths = normalizePathList(record.sidecar_paths)

  const allowedStatuses = allowArchived
    ? new Set(['abandoned', 'pending', 'reconciled'])
    : new Set(['pending'])
  if (!allowedStatuses.has(record.status)) {
    throw new HandoffError(
      'HANDOFF_INVALID',
      'Handoff record has an invalid status',
    )
  }
  if (
    !Number.isFinite(Date.parse(record.created_at)) ||
    !Number.isFinite(Date.parse(record.updated_at))
  ) {
    throw new HandoffError(
      'HANDOFF_INVALID',
      'Handoff record timestamps are invalid',
    )
  }

  return {
    ...record,
    claim: {
      branch,
      id: paths.id,
      kind: paths.kind,
      token_file: tokenFile,
    },
    original_run_id: originalRunId,
    parent_thread_id: parentThreadId,
    scope,
    sidecar_paths: sidecarPaths,
    task_url: taskUrl,
    worktree_path: worktreePath,
    worker_thread_id: workerId,
    next_reconciliation_action: nextAction,
  }
}

const getArchivePath = (record, paths) => {
  const identity = `${record.created_at}:${record.worker_thread_id}`
  const suffix = createHash('sha256')
    .update(identity)
    .digest('hex')
    .slice(0, 12)
  return path.join(paths.archiveRoot, `${paths.handoffId}-${suffix}.json`)
}

const publicHandoff = (record, paths, handoffPath) => ({
  automation_id: paths.automationId,
  claim: record.claim,
  created_at: record.created_at,
  handoff_id: paths.handoffId,
  handoff_path: handoffPath,
  next_reconciliation_action: record.next_reconciliation_action,
  original_run_id: record.original_run_id,
  parent_thread_id: record.parent_thread_id,
  scope: record.scope,
  sidecar_paths: record.sidecar_paths,
  status: record.status,
  task_url: record.task_url,
  updated_at: record.updated_at,
  worker_thread_id: record.worker_thread_id,
  worktree_path: record.worktree_path,
})

const createRecord = (options, paths) => {
  const now = assertDate(getNow(options)).toISOString()
  return {
    automation_id: paths.automationId,
    claim: {
      branch: normalizeOptionalBranch(options.branch),
      id: paths.id,
      kind: paths.kind,
      token_file: normalizeAbsolutePath(options.tokenFile, '--token-file'),
    },
    created_at: now,
    handoff_id: paths.handoffId,
    next_reconciliation_action: normalizeText(
      options.nextAction,
      '--next-action',
    ),
    original_run_id: normalizeText(options.runId, '--run-id', {
      optional: true,
    }),
    parent_thread_id: normalizeText(
      options.parentThreadId,
      '--parent-thread-id',
      {
        optional: true,
      },
    ),
    scope: normalizeText(options.scope, '--scope'),
    sidecar_paths: normalizePathList(options.sidecarPaths),
    status: 'pending',
    task_url: normalizeText(options.taskUrl, '--task-url', { optional: true }),
    updated_at: now,
    version: 1,
    worker_thread_id: normalizeText(options.workerThreadId, '--worker-id'),
    worktree_path: normalizeAbsolutePath(options.worktreePath, '--worktree'),
  }
}

export const createHandoff = async (options) => {
  const paths = getPaths(options)
  const record = createRecord(options, paths)
  await mkdir(paths.pendingRoot, { mode: 0o700, recursive: true })

  try {
    await createJsonAtomically(paths.pendingFile, record)
  } catch (error) {
    if (error instanceof HandoffError && error.codeName === 'HANDOFF_ACTIVE') {
      let details = null
      try {
        const existing = assertRecord(await readJson(paths.pendingFile), paths)
        details = publicHandoff(existing, paths, paths.pendingFile)
      } catch {
        // The duplicate signal remains authoritative when enrichment races or fails.
      }

      throw new HandoffError(
        'HANDOFF_ACTIVE',
        `A pending handoff already exists for ${paths.handoffId}`,
        { details },
      )
    }
    throw error
  }

  return {
    handoff: publicHandoff(record, paths, paths.pendingFile),
    ok: true,
    status: 'created',
  }
}

export const listPendingHandoffs = async (options) => {
  const automationId = normalizePathSegment(
    options.automationId,
    '--automation-id',
  )
  const handoffRoot = normalizeAbsolutePath(
    options.handoffRoot || getDefaultHandoffRoot(automationId, options.env),
    '--root',
  )
  const pendingRoot = path.join(handoffRoot, 'pending')
  let entries

  try {
    entries = await readdir(pendingRoot, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        handoff_root: handoffRoot,
        handoffs: [],
        ok: true,
        status: 'listed',
      }
    }
    throw new HandoffError(
      'HANDOFF_UNREADABLE',
      `Pending handoff directory cannot be read safely: ${pendingRoot}`,
      { details: { cause: error?.message } },
    )
  }

  const records = []
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue
    }

    const match = /^(pr|issue)-([A-Za-z0-9][A-Za-z0-9._-]*)\.json$/.exec(
      entry.name,
    )
    if (!match) {
      throw new HandoffError(
        'HANDOFF_INVALID',
        `Pending handoff file has an invalid name: ${entry.name}`,
      )
    }

    const [, kind, id] = match
    const paths = getPaths({ automationId, handoffRoot, id, kind })
    const record = assertRecord(await readJson(paths.pendingFile), paths)
    records.push(publicHandoff(record, paths, paths.pendingFile))
  }

  return {
    handoff_root: handoffRoot,
    handoffs: records,
    ok: true,
    status: 'listed',
  }
}

export const archiveHandoff = async (options) => {
  const paths = getPaths(options)
  const record = assertRecord(await readJson(paths.pendingFile), paths)
  const workerThreadId = normalizeText(options.workerThreadId, '--worker-id')
  const outcome = normalizeText(options.outcome, '--outcome')
  if (!allowedArchiveOutcomes.has(outcome)) {
    throw new HandoffError(
      'USAGE',
      '--outcome must be reconciled or abandoned',
      { exitCode: 1 },
    )
  }
  if (record.worker_thread_id !== workerThreadId) {
    throw new HandoffError(
      'WORKER_MISMATCH',
      'The pending handoff belongs to a different worker thread',
    )
  }

  const now = assertDate(getNow(options)).toISOString()
  const archivedRecord = {
    ...record,
    archived_at: now,
    reconciliation_note: normalizeText(options.note, '--note'),
    reconciliation_run_id: normalizeText(options.runId, '--run-id', {
      optional: true,
    }),
    status: outcome,
    updated_at: now,
  }
  const archivePath = getArchivePath(record, paths)
  await mkdir(paths.archiveRoot, { mode: 0o700, recursive: true })

  try {
    await createJsonAtomically(archivePath, archivedRecord)
  } catch (error) {
    if (
      !(error instanceof HandoffError) ||
      error.codeName !== 'HANDOFF_ACTIVE'
    ) {
      throw error
    }

    const existing = assertRecord(await readJson(archivePath), paths, {
      allowArchived: true,
    })
    if (
      existing.status !== outcome ||
      existing.worker_thread_id !== workerThreadId
    ) {
      throw new HandoffError(
        'HANDOFF_ARCHIVE_CONFLICT',
        `Completed handoff conflicts with the pending record: ${archivePath}`,
      )
    }
  }

  try {
    await rm(paths.pendingFile)
  } catch (error) {
    throw new HandoffError(
      'HANDOFF_ARCHIVE_UNCERTAIN',
      `Completed handoff was saved but pending record could not be removed: ${paths.pendingFile}`,
      { details: { archive_path: archivePath, cause: error?.message } },
    )
  }

  return {
    handoff: publicHandoff(archivedRecord, paths, archivePath),
    ok: true,
    status: 'archived',
  }
}

const parseCliArgs = (argv) => {
  const command = argv[2]
  const flags = {}
  const repeatableFlags = new Set(['sidecar'])
  const knownFlags = new Set([
    'automation-id',
    'branch',
    'help',
    'id',
    'kind',
    'next-action',
    'note',
    'outcome',
    'parent-thread-id',
    'root',
    'run-id',
    'scope',
    'sidecar',
    'task-url',
    'token-file',
    'worker-id',
    'worktree',
  ])

  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('--')) {
      throw new HandoffError(
        'USAGE',
        `Unexpected positional argument: ${arg}`,
        {
          exitCode: 1,
        },
      )
    }

    const equalsIndex = arg.indexOf('=')
    const key = arg.slice(2, equalsIndex === -1 ? undefined : equalsIndex)
    if (!knownFlags.has(key)) {
      throw new HandoffError('USAGE', `Unknown flag: --${key}`, {
        exitCode: 1,
      })
    }

    let value
    if (equalsIndex !== -1) {
      value = arg.slice(equalsIndex + 1)
    } else {
      const nextArg = argv[index + 1]
      if (!nextArg || nextArg.startsWith('--')) {
        if (key === 'help') {
          flags[key] = true
          continue
        }
        throw new HandoffError('USAGE', `--${key} requires a value`, {
          exitCode: 1,
        })
      }
      value = nextArg
      index += 1
    }

    if (repeatableFlags.has(key)) {
      flags[key] ??= []
      flags[key].push(value)
      continue
    }
    if (Object.hasOwn(flags, key)) {
      throw new HandoffError('USAGE', `--${key} may be provided only once`, {
        exitCode: 1,
      })
    }
    flags[key] = value
  }

  return { command, flags }
}

const mapCliOptions = (flags) => ({
  automationId: flags['automation-id'],
  branch: flags.branch,
  handoffRoot: flags.root,
  id: flags.id,
  kind: flags.kind,
  nextAction: flags['next-action'],
  note: flags.note,
  outcome: flags.outcome,
  parentThreadId: flags['parent-thread-id'],
  runId: flags['run-id'],
  scope: flags.scope,
  sidecarPaths: flags.sidecar,
  taskUrl: flags['task-url'],
  tokenFile: flags['token-file'],
  workerThreadId: flags['worker-id'],
  worktreePath: flags.worktree,
})

const usage = `Usage:
  node scripts/automationHandoff.mjs create --automation-id ID --kind pr|issue --id ID --worker-id THREAD --token-file PATH --scope TEXT --next-action TEXT --worktree PATH [--branch NAME] [--parent-thread-id THREAD] [--run-id ID] [--task-url URL] [--sidecar PATH] [--root PATH]
  node scripts/automationHandoff.mjs list --automation-id ID [--root PATH]
  node scripts/automationHandoff.mjs archive --automation-id ID --kind pr|issue --id ID --worker-id THREAD --outcome reconciled|abandoned --note TEXT [--run-id ID] [--root PATH]

Handoffs are stored in:
  $SPACE_WEB_GAME_HANDOFF_ROOT, or
  $CODEX_HOME/automations/<active automation id>/handoffs`

export const runCli = async (argv = process.argv) => {
  const { command, flags } = parseCliArgs(argv)
  if (!command || command === 'help' || flags.help) {
    return { ok: true, status: 'help', usage }
  }

  const options = mapCliOptions(flags)
  switch (command) {
    case 'archive':
      return archiveHandoff(options)
    case 'create':
      return createHandoff(options)
    case 'list':
      return listPendingHandoffs(options)
    default:
      throw new HandoffError('USAGE', `Unknown command: ${command}`, {
        exitCode: 1,
      })
  }
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  runCli()
    .then((result) => {
      if (result.status === 'help') {
        console.log(result.usage)
        return
      }
      console.log(JSON.stringify(result, null, 2))
    })
    .catch((error) => {
      if (error instanceof HandoffError) {
        console.error(
          JSON.stringify(
            {
              error: {
                code: error.codeName,
                details: error.details,
                message: error.message,
              },
              ok: false,
            },
            null,
            2,
          ),
        )
        process.exit(error.exitCode)
      }

      console.error(
        JSON.stringify(
          {
            error: {
              code: 'UNEXPECTED',
              message: error?.message ?? String(error),
            },
            ok: false,
          },
          null,
          2,
        ),
      )
      process.exit(1)
    })
}
