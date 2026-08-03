import { createHash, randomBytes } from 'node:crypto'
import {
  chmod,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { homedir, hostname } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const allowedKinds = new Set(['pr', 'issue'])
const defaultTtlSeconds = 4 * 60 * 60
const defaultMutexTimeoutMs = 5000
const taskIdPattern = /^[A-Za-z0-9._-]+$/
const purposeRegistrationPattern =
  /^automation_id=([^;]+);token_file=([^;]+)(?:;.*)?$/

export class ClaimError extends Error {
  constructor(codeName, message, options = {}) {
    super(message)
    this.name = 'ClaimError'
    this.codeName = codeName
    this.details = options.details ?? null
    this.exitCode = options.exitCode ?? 2
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const getDefaultClaimRoot = (env = process.env) => {
  if (env.SPACE_WEB_GAME_TASK_CLAIM_ROOT) {
    return env.SPACE_WEB_GAME_TASK_CLAIM_ROOT
  }

  const codexHome = env.CODEX_HOME || path.join(homedir(), '.codex')
  return path.join(codexHome, 'automation-locks', 'space-web-game', 'tasks')
}

const validatePurposeRegistration = (options) => {
  if (options.purpose === undefined || options.purpose === null) {
    return null
  }

  if (typeof options.purpose !== 'string' || options.purpose.length === 0) {
    throw new ClaimError(
      'USAGE',
      '--purpose must begin with automation_id=<active automation id>;token_file=<absolute token-file path>',
      { exitCode: 1 },
    )
  }

  const match = options.purpose.match(purposeRegistrationPattern)
  if (!match) {
    throw new ClaimError(
      'USAGE',
      '--purpose must begin with automation_id=<active automation id>;token_file=<absolute token-file path>',
      { exitCode: 1 },
    )
  }

  const [, automationId, registeredTokenFile] = match
  if (
    !taskIdPattern.test(automationId) ||
    automationId === '.' ||
    automationId === '..'
  ) {
    throw new ClaimError(
      'USAGE',
      '--purpose automation_id may contain only letters, digits, dots, underscores, and dashes',
      { exitCode: 1 },
    )
  }

  if (!path.isAbsolute(registeredTokenFile)) {
    throw new ClaimError('USAGE', '--purpose token_file must be absolute', {
      exitCode: 1,
    })
  }

  if (path.normalize(registeredTokenFile) !== registeredTokenFile) {
    throw new ClaimError(
      'USAGE',
      '--purpose token_file must be a normalized absolute path',
      { exitCode: 1 },
    )
  }

  if (!options.tokenFile) {
    throw new ClaimError(
      'USAGE',
      'A registered --purpose requires the matching --token-file',
      { exitCode: 1 },
    )
  }

  if (options.tokenFile !== registeredTokenFile) {
    throw new ClaimError(
      'USAGE',
      '--purpose token_file must match --token-file',
      { exitCode: 1 },
    )
  }

  const env = options.env ?? process.env
  const codexHome = env.CODEX_HOME || path.join(homedir(), '.codex')
  const tokenRoot = path.resolve(
    codexHome,
    'automations',
    automationId,
    'tokens',
  )
  const tokenRelativePath = path.relative(tokenRoot, registeredTokenFile)
  if (
    !tokenRelativePath ||
    tokenRelativePath === '..' ||
    tokenRelativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(tokenRelativePath)
  ) {
    throw new ClaimError(
      'USAGE',
      '--purpose token_file must be under the registered automation tokens directory',
      { exitCode: 1 },
    )
  }

  return options.purpose
}

const parsePositiveInteger = (value, label) => {
  if (!/^\d+$/.test(String(value))) {
    throw new ClaimError('USAGE', `${label} must be a positive integer`, {
      exitCode: 1,
    })
  }

  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ClaimError('USAGE', `${label} must be a positive integer`, {
      exitCode: 1,
    })
  }
  return parsed
}

const normalizeKind = (kind) => {
  if (!allowedKinds.has(kind)) {
    throw new ClaimError('USAGE', '--kind must be pr or issue', {
      exitCode: 1,
    })
  }
  return kind
}

const normalizeTaskId = (id) => {
  const normalized = String(id ?? '').trim()
  if (!taskIdPattern.test(normalized)) {
    throw new ClaimError(
      'USAGE',
      '--id is required and may contain only letters, digits, dots, underscores, and dashes',
      { exitCode: 1 },
    )
  }
  return normalized
}

const getTaskKey = (kind, id) => `${kind}-${id}`

const getTaskPaths = (options) => {
  const kind = normalizeKind(options.kind)
  const id = normalizeTaskId(options.id)
  const taskKey = getTaskKey(kind, id)
  const claimRoot = options.claimRoot || getDefaultClaimRoot(options.env)

  return {
    claimFile: path.join(claimRoot, `${taskKey}.json`),
    claimRoot,
    id,
    kind,
    mutexDir: path.join(claimRoot, '.mutexes', 'claims.lock'),
    taskKey,
    taskMutexRoot: path.join(claimRoot, '.mutexes'),
  }
}

const sha256Token = (token) =>
  `sha256:${createHash('sha256').update(token).digest('hex')}`

const generateToken = () => randomBytes(32).toString('base64url')

const parseDateMs = (value) => {
  if (typeof value !== 'string') {
    return Number.NaN
  }
  return Date.parse(value)
}

const parseStoredPositiveInteger = (value) => {
  const normalized = String(value)
  if (!/^\d+$/.test(normalized)) {
    return null
  }

  const parsed = Number.parseInt(normalized, 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

const getNow = (options) => options.now ?? new Date()

const getOwner = (options) => {
  if (options.owner) {
    return options.owner
  }

  const env = options.env ?? process.env
  return (
    env.CODEX_OWNER ||
    env.CODEX_THREAD_ID ||
    env.AUTOMATION_RUN_ID ||
    env.USER ||
    'unknown'
  )
}

const getPid = (options) => {
  if (options.pid === null) {
    return null
  }

  if (options.pid !== undefined) {
    return parsePositiveInteger(options.pid, '--pid')
  }

  return process.pid
}

const ensureTaskStorage = async (paths) => {
  await mkdir(paths.claimRoot, { mode: 0o700, recursive: true })
  await mkdir(paths.taskMutexRoot, { mode: 0o700, recursive: true })
}

const writeJsonAtomic = async (filePath, payload) => {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, {
    mode: 0o600,
  })
  await rename(tempPath, filePath)
  await chmod(filePath, 0o600).catch(() => {})
}

const writeTokenFile = async (filePath, token) => {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 })
  await writeFile(filePath, `${token}\n`, { mode: 0o600 })
  await chmod(filePath, 0o600)
}

const readTokenFile = async (filePath) => {
  const token = (await readFile(filePath, 'utf8')).trim()
  if (!token) {
    throw new ClaimError('USAGE', `Token file is empty: ${filePath}`, {
      exitCode: 1,
    })
  }
  return token
}

const readClaim = async (claimFile) => {
  try {
    return JSON.parse(await readFile(claimFile, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null
    }

    throw new ClaimError(
      'CLAIM_UNREADABLE',
      `Existing claim cannot be read safely: ${claimFile}`,
      { details: { cause: error?.message } },
    )
  }
}

const assertClaimShape = (claim, paths) => {
  if (!claim || typeof claim !== 'object') {
    throw new ClaimError('CLAIM_INVALID', 'Existing claim is not an object')
  }

  if (claim.kind !== paths.kind || String(claim.id) !== paths.id) {
    throw new ClaimError(
      'CLAIM_INVALID',
      'Existing claim kind/id does not match its task path',
      {
        details: {
          expected: { id: paths.id, kind: paths.kind },
          received: { id: claim.id, kind: claim.kind },
        },
      },
    )
  }
}

const publicClaim = (claim, paths) => ({
  branch: claim.branch ?? null,
  claim_path: paths.claimFile,
  hostname: claim.hostname ?? null,
  id: claim.id,
  kind: claim.kind,
  last_seen: claim.last_seen ?? null,
  owner: claim.owner ?? null,
  pid: claim.pid ?? null,
  purpose: claim.purpose ?? null,
  run_id: claim.run_id ?? null,
  started_at: claim.started_at ?? null,
  status: claim.status ?? null,
  task_key: paths.taskKey,
  thread_id: claim.thread_id ?? null,
  ttl_seconds: claim.ttl_seconds ?? null,
})

const getExpiryMs = (claim) => {
  const lastSeenMs = parseDateMs(claim.last_seen)
  const ttlSeconds = parseStoredPositiveInteger(claim.ttl_seconds)
  if (!Number.isFinite(lastSeenMs) || ttlSeconds === null) {
    return Number.NaN
  }
  return lastSeenMs + ttlSeconds * 1000
}

const getLocalPidLiveness = (claim) => {
  if (claim.pid === null || claim.pid === undefined) {
    return 'not-recorded'
  }

  const pid = parseStoredPositiveInteger(claim.pid)
  if (pid === null) {
    return 'unknown'
  }

  if (claim.hostname && claim.hostname !== hostname()) {
    return 'unknown'
  }

  try {
    process.kill(pid, 0)
    return 'live'
  } catch (error) {
    if (error?.code === 'ESRCH') {
      return 'dead'
    }
    return 'unknown'
  }
}

const readMutexOwner = async (ownerFile) => {
  try {
    return JSON.parse(await readFile(ownerFile, 'utf8'))
  } catch {
    return null
  }
}

const getPathAgeMs = async (filePath) => {
  try {
    const stats = await stat(filePath)
    return Math.max(0, Date.now() - stats.mtimeMs)
  } catch {
    return 0
  }
}

const reclaimStaleMutex = async (mutexDir, staleAfterMs) => {
  const owner = await readMutexOwner(path.join(mutexDir, 'owner.json'))
  if (!owner) {
    if ((await getPathAgeMs(mutexDir)) < staleAfterMs) {
      return false
    }

    await rm(mutexDir, { force: true, recursive: true })
    return true
  }

  if (getLocalPidLiveness(owner) !== 'dead') {
    return false
  }

  await rm(mutexDir, { force: true, recursive: true })
  return true
}

const getAcquireDecision = (claim, paths, now) => {
  assertClaimShape(claim, paths)

  if (claim.status === 'released') {
    return {
      canAcquire: true,
      reason: `previous claim status is ${claim.status}`,
    }
  }

  if (claim.status !== 'active') {
    return {
      canAcquire: false,
      codeName: 'CLAIM_UNCERTAIN',
      message: `Existing claim has unknown status: ${claim.status ?? '<unset>'}`,
    }
  }

  const expiryMs = getExpiryMs(claim)
  if (!Number.isFinite(expiryMs)) {
    return {
      canAcquire: false,
      codeName: 'CLAIM_UNCERTAIN',
      message: 'Existing claim has invalid TTL metadata',
    }
  }

  if (now.getTime() <= expiryMs) {
    return {
      canAcquire: false,
      codeName: 'CLAIM_ACTIVE',
      message: `Task ${paths.taskKey} is already claimed`,
    }
  }

  const pidLiveness = getLocalPidLiveness(claim)
  if (pidLiveness === 'live') {
    return {
      canAcquire: false,
      codeName: 'CLAIM_PID_LIVE',
      message: `Task ${paths.taskKey} claim expired, but recorded local pid is still live`,
    }
  }

  if (pidLiveness === 'unknown') {
    return {
      canAcquire: false,
      codeName: 'CLAIM_UNCERTAIN',
      message: `Task ${paths.taskKey} claim expired, but pid liveness is uncertain`,
    }
  }

  return {
    canAcquire: true,
    reason: `previous claim expired and local pid is ${pidLiveness}`,
  }
}

const getPathsForExistingClaim = (claimRoot, claimFile, claim) => {
  if (!allowedKinds.has(claim.kind)) {
    throw new ClaimError('CLAIM_INVALID', 'Existing claim has invalid kind', {
      details: { claim_file: claimFile, kind: claim.kind },
    })
  }

  const id = String(claim.id ?? '').trim()
  if (!taskIdPattern.test(id)) {
    throw new ClaimError('CLAIM_INVALID', 'Existing claim has invalid id', {
      details: { claim_file: claimFile, id: claim.id },
    })
  }

  const kind = claim.kind
  const taskKey = getTaskKey(kind, id)

  if (path.basename(claimFile) !== `${taskKey}.json`) {
    throw new ClaimError(
      'CLAIM_INVALID',
      'Existing claim kind/id does not match its file name',
      {
        details: {
          claim_file: claimFile,
          expected_file: `${taskKey}.json`,
        },
      },
    )
  }

  return {
    claimFile,
    claimRoot,
    id,
    kind,
    mutexDir: path.join(claimRoot, '.mutexes', 'claims.lock'),
    taskKey,
    taskMutexRoot: path.join(claimRoot, '.mutexes'),
  }
}

const assertBranchNotClaimed = async (paths, branch, now) => {
  if (!branch) {
    return null
  }

  const entries = await readdir(paths.claimRoot, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue
    }

    const claimFile = path.join(paths.claimRoot, entry.name)
    if (claimFile === paths.claimFile) {
      continue
    }

    const claim = await readClaim(claimFile)
    if (!claim || claim.branch !== branch) {
      continue
    }

    const existingPaths = getPathsForExistingClaim(
      paths.claimRoot,
      claimFile,
      claim,
    )
    const decision = getAcquireDecision(claim, existingPaths, now)
    if (decision.canAcquire) {
      continue
    }

    const codeName =
      decision.codeName === 'CLAIM_ACTIVE'
        ? 'BRANCH_CLAIM_ACTIVE'
        : decision.codeName

    throw new ClaimError(
      codeName,
      `Branch ${branch} is already claimed by ${existingPaths.taskKey}`,
      {
        details: {
          branch,
          claim: publicClaim(claim, existingPaths),
          reason: decision.message,
        },
      },
    )
  }

  return null
}

const assertBranchMatches = (claim, branch) => {
  if (branch === undefined || branch === null || branch === '') {
    return
  }

  if (claim.branch !== branch) {
    throw new ClaimError(
      'BRANCH_MISMATCH',
      `Claim branch is ${claim.branch ?? '<unset>'}, not ${branch}`,
    )
  }
}

const assertTokenMatches = (claim, token) => {
  if (!token) {
    throw new ClaimError('USAGE', 'A claim token is required', { exitCode: 1 })
  }

  if (claim.token_hash !== sha256Token(token)) {
    throw new ClaimError('TOKEN_MISMATCH', 'Claim token does not match')
  }
}

const assertClaimUsable = (claim, paths, options = {}) => {
  if (!claim) {
    throw new ClaimError(
      'CLAIM_MISSING',
      `No claim exists for ${paths.taskKey}`,
    )
  }

  assertClaimShape(claim, paths)
  assertBranchMatches(claim, options.branch)
  assertTokenMatches(claim, options.token)

  if (claim.status !== 'active') {
    throw new ClaimError(
      'CLAIM_NOT_ACTIVE',
      `Claim status is ${claim.status ?? '<unset>'}`,
    )
  }

  if (!options.allowExpired) {
    const expiryMs = getExpiryMs(claim)
    if (!Number.isFinite(expiryMs)) {
      throw new ClaimError(
        'CLAIM_UNCERTAIN',
        'Existing claim has invalid TTL metadata',
      )
    }

    if (getNow(options).getTime() > expiryMs) {
      throw new ClaimError(
        'CLAIM_EXPIRED',
        `Claim expired for ${paths.taskKey}`,
      )
    }
  }
}

const withTaskMutex = async (paths, options, callback) => {
  await ensureTaskStorage(paths)

  const timeoutMs =
    options.mutexTimeoutMs === undefined
      ? defaultMutexTimeoutMs
      : parsePositiveInteger(options.mutexTimeoutMs, '--mutex-timeout-ms')
  const deadline = Date.now() + timeoutMs

  while (true) {
    try {
      await mkdir(paths.mutexDir, { mode: 0o700 })
      break
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error
      }

      if (await reclaimStaleMutex(paths.mutexDir, timeoutMs)) {
        continue
      }

      if (Date.now() >= deadline) {
        throw new ClaimError(
          'MUTEX_BUSY',
          `Timed out waiting for task mutex ${paths.mutexDir}`,
          { details: { mutex_dir: paths.mutexDir } },
        )
      }

      await sleep(50)
    }
  }

  try {
    await writeJsonAtomic(path.join(paths.mutexDir, 'owner.json'), {
      hostname: hostname(),
      pid: process.pid,
      started_at: new Date().toISOString(),
      target: 'all-task-claims',
      task_key: paths.taskKey,
    })
    return await callback()
  } finally {
    await rm(paths.mutexDir, { force: true, recursive: true }).catch(() => {})
  }
}

const normalizeClaimOptions = async (options) => {
  if (options.tokenFile && options.token === undefined) {
    return { ...options, token: await readTokenFile(options.tokenFile) }
  }

  return options
}

export const acquireClaim = async (rawOptions) => {
  const options = rawOptions
  const purpose = validatePurposeRegistration(options)
  const paths = getTaskPaths(options)
  const token = options.token || generateToken()
  const ttlSeconds =
    options.ttlSeconds === undefined
      ? defaultTtlSeconds
      : parsePositiveInteger(options.ttlSeconds, '--ttl')
  const env = options.env ?? process.env

  return withTaskMutex(paths, options, async () => {
    const now = getNow(options)
    const existingClaim = await readClaim(paths.claimFile)
    let replaceReason = null

    if (existingClaim) {
      const decision = getAcquireDecision(existingClaim, paths, now)
      if (!decision.canAcquire) {
        throw new ClaimError(decision.codeName, decision.message, {
          details: { claim: publicClaim(existingClaim, paths) },
        })
      }
      replaceReason = decision.reason
    }

    await assertBranchNotClaimed(paths, options.branch, now)

    const claim = {
      branch: options.branch || null,
      hostname: hostname(),
      id: paths.id,
      kind: paths.kind,
      last_seen: now.toISOString(),
      owner: getOwner(options),
      pid: getPid(options),
      purpose,
      run_id: env.AUTOMATION_RUN_ID || env.CODEX_RUN_ID || null,
      started_at: now.toISOString(),
      status: 'active',
      thread_id: env.CODEX_THREAD_ID || null,
      token_hash: sha256Token(token),
      ttl_seconds: ttlSeconds,
      version: 1,
    }

    if (options.tokenFile) {
      await writeTokenFile(options.tokenFile, token)
    }

    await writeJsonAtomic(paths.claimFile, claim)

    return {
      claim: publicClaim(claim, paths),
      ok: true,
      replaced: Boolean(existingClaim),
      replace_reason: replaceReason,
      status: 'acquired',
      token,
    }
  })
}

export const verifyClaim = async (rawOptions) => {
  const options = await normalizeClaimOptions(rawOptions)
  const paths = getTaskPaths(options)

  return withTaskMutex(paths, options, async () => {
    const claim = await readClaim(paths.claimFile)
    assertClaimUsable(claim, paths, options)

    return {
      claim: publicClaim(claim, paths),
      ok: true,
      status: 'verified',
    }
  })
}

export const heartbeatClaim = async (rawOptions) => {
  const options = await normalizeClaimOptions(rawOptions)
  const paths = getTaskPaths(options)

  return withTaskMutex(paths, options, async () => {
    const now = getNow(options)
    const claim = await readClaim(paths.claimFile)
    assertClaimUsable(claim, paths, { ...options, now })

    const nextClaim = {
      ...claim,
      last_seen: now.toISOString(),
    }
    await writeJsonAtomic(paths.claimFile, nextClaim)

    return {
      claim: publicClaim(nextClaim, paths),
      ok: true,
      status: 'heartbeat',
    }
  })
}

export const releaseClaim = async (rawOptions) => {
  const options = await normalizeClaimOptions(rawOptions)
  const paths = getTaskPaths(options)

  return withTaskMutex(paths, options, async () => {
    const now = getNow(options)
    const claim = await readClaim(paths.claimFile)
    assertClaimUsable(claim, paths, {
      ...options,
      allowExpired: true,
      now,
    })

    const nextClaim = {
      ...claim,
      last_seen: now.toISOString(),
      released_at: now.toISOString(),
      status: 'released',
    }
    await writeJsonAtomic(paths.claimFile, nextClaim)

    return {
      claim: publicClaim(nextClaim, paths),
      ok: true,
      status: 'released',
    }
  })
}

const parseCliArgs = (argv) => {
  const command = argv[2]
  const flags = {}
  const cliFlagNames = new Set([
    'branch',
    'help',
    'id',
    'kind',
    'mutex-timeout-ms',
    'owner',
    'pid',
    'print-token',
    'purpose',
    'root',
    'token',
    'token-file',
    'ttl',
  ])
  const assertKnownCliFlag = (key) => {
    if (!cliFlagNames.has(key)) {
      throw new ClaimError('USAGE', `Unknown flag: --${key}`, {
        exitCode: 1,
      })
    }
  }

  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('--')) {
      throw new ClaimError('USAGE', `Unexpected positional argument: ${arg}`, {
        exitCode: 1,
      })
    }

    const equalsIndex = arg.indexOf('=')
    if (equalsIndex !== -1) {
      const key = arg.slice(2, equalsIndex)
      assertKnownCliFlag(key)
      flags[key] = arg.slice(equalsIndex + 1)
      continue
    }

    const key = arg.slice(2)
    assertKnownCliFlag(key)
    const nextArg = argv[index + 1]
    if (!nextArg || nextArg.startsWith('--')) {
      flags[key] = true
      continue
    }

    flags[key] = nextArg
    index += 1
  }

  return { command, flags }
}

const getFlagValue = (flags, key) => {
  const value = flags[key]
  if (value === true) {
    throw new ClaimError('USAGE', `--${key} requires a value`, {
      exitCode: 1,
    })
  }
  return value
}

const mapCliOptions = (flags) => ({
  branch: getFlagValue(flags, 'branch'),
  claimRoot: getFlagValue(flags, 'root'),
  id: getFlagValue(flags, 'id'),
  kind: getFlagValue(flags, 'kind'),
  mutexTimeoutMs: getFlagValue(flags, 'mutex-timeout-ms'),
  owner: getFlagValue(flags, 'owner'),
  pid: flags.pid === 'none' ? null : getFlagValue(flags, 'pid'),
  printToken: flags['print-token'] === true,
  purpose: getFlagValue(flags, 'purpose'),
  token: getFlagValue(flags, 'token'),
  tokenFile: getFlagValue(flags, 'token-file'),
  ttlSeconds: getFlagValue(flags, 'ttl'),
})

const usage = `Usage:
  node scripts/automationTaskClaim.mjs acquire --kind pr|issue --id ID [--branch NAME] [--owner OWNER] [--purpose "automation_id=ID;token_file=PATH;..."] [--ttl SECONDS] [--token TOKEN|--token-file PATH|--print-token]
  node scripts/automationTaskClaim.mjs heartbeat --kind pr|issue --id ID --token TOKEN|--token-file PATH [--branch NAME]
  node scripts/automationTaskClaim.mjs verify --kind pr|issue --id ID --token TOKEN|--token-file PATH [--branch NAME]
  node scripts/automationTaskClaim.mjs release --kind pr|issue --id ID --token TOKEN|--token-file PATH [--branch NAME]

Supplied purpose registration must use the matching canonical automation token file.

Claims are stored in:
  $SPACE_WEB_GAME_TASK_CLAIM_ROOT, or
  $CODEX_HOME/automation-locks/space-web-game/tasks`

export const runCli = async (argv = process.argv) => {
  const { command, flags } = parseCliArgs(argv)

  if (!command || command === 'help' || flags.help) {
    return { ok: true, status: 'help', usage }
  }

  const options = mapCliOptions(flags)
  switch (command) {
    case 'acquire': {
      if (!options.token && !options.tokenFile && !options.printToken) {
        throw new ClaimError(
          'USAGE',
          'acquire requires --token, --token-file, or explicit --print-token',
          { exitCode: 1 },
        )
      }

      const result = await acquireClaim(options)
      if (!options.printToken) {
        const { token: _token, ...redactedResult } = result
        return {
          ...redactedResult,
          token_file: options.tokenFile ?? null,
          token_redacted: true,
        }
      }
      return result
    }
    case 'heartbeat':
      return heartbeatClaim(options)
    case 'release':
      return releaseClaim(options)
    case 'verify':
      return verifyClaim(options)
    default:
      throw new ClaimError('USAGE', `Unknown command: ${command}`, {
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
      if (error instanceof ClaimError) {
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
