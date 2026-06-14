import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const PRODUCTION_SITE_ID = '0ed821be-c897-4f15-ad17-859ae866ca1d'
const DEFAULT_STAGING_TARGET = 'shared'
const LOCAL_DEPLOY_CONFIG_PATH = '.netlify-deploy.local.json'
const STAGING_TARGETS = {
  shared: {
    label: 'staging:shared',
    siteId: 'e0d8dda6-9340-4d3c-9e78-941ccbb63d5f',
  },
  'woven-moth': {
    label: 'staging:woven-moth',
    siteId: '65b8db6a-f0cc-49e3-b4e4-cc994699ba6a',
  },
}

const parseArgs = () => {
  let mode = 'auto'
  let stagingTarget = null

  for (const arg of process.argv) {
    if (arg.startsWith('--mode=')) {
      const [, value] = arg.split('=')
      mode = value === 'production' || value === 'staging' ? value : 'auto'
    }
    if (arg.startsWith('--staging-target=')) {
      const [, value] = arg.split('=')
      stagingTarget = value || null
    }
  }

  return { mode, stagingTarget }
}

const readLocalDeployConfig = () => {
  if (!existsSync(LOCAL_DEPLOY_CONFIG_PATH)) {
    return {}
  }

  const config = JSON.parse(readFileSync(LOCAL_DEPLOY_CONFIG_PATH, 'utf8'))
  return config && typeof config === 'object' ? config : {}
}

const getCurrentBranch = () => {
  const branchFromEnv =
    process.env.BRANCH ||
    process.env.GIT_BRANCH ||
    process.env.HEAD ||
    process.env.NETLIFY_BRANCH

  if (branchFromEnv) {
    return branchFromEnv
  }

  return execFileSync('git', ['branch', '--show-current'], {
    encoding: 'utf8',
  }).trim()
}

const getCurrentCommit = () => {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
    }).trim()
  } catch {
    return 'unknown'
  }
}

const resolveStagingTarget = (requestedTarget, localConfig) => {
  const targetKey =
    requestedTarget ||
    process.env.NETLIFY_STAGING_TARGET ||
    localConfig.defaultStagingTarget ||
    DEFAULT_STAGING_TARGET

  if (STAGING_TARGETS[targetKey]) {
    return STAGING_TARGETS[targetKey]
  }

  if (process.env.NETLIFY_STAGING_SITE_ID && !requestedTarget) {
    return {
      label: 'staging:env',
      siteId: process.env.NETLIFY_STAGING_SITE_ID,
    }
  }

  if (typeof targetKey === 'string' && targetKey.length > 0) {
    return {
      label: `staging:${targetKey}`,
      siteId: targetKey,
    }
  }

  return STAGING_TARGETS[DEFAULT_STAGING_TARGET]
}

const resolveTarget = (mode, branch, requestedStagingTarget, localConfig) => {
  if (mode === 'production') {
    return {
      label: 'production',
      siteId: process.env.NETLIFY_PRODUCTION_SITE_ID || PRODUCTION_SITE_ID,
    }
  }

  if (mode === 'staging' || branch !== 'main') {
    return resolveStagingTarget(requestedStagingTarget, localConfig)
  }

  return {
    label: 'production',
    siteId: process.env.NETLIFY_PRODUCTION_SITE_ID || PRODUCTION_SITE_ID,
  }
}

const { mode, stagingTarget } = parseArgs()
const localDeployConfig = readLocalDeployConfig()
const branch = getCurrentBranch()
const commit = getCurrentCommit()
const target = resolveTarget(mode, branch, stagingTarget, localDeployConfig)
const message = `${target.label} deploy from ${branch}@${commit}`

console.log(
  `Deploying branch "${branch}" to Netlify ${target.label} site ${target.siteId}.`,
)

const result = spawnSync(
  'npx',
  [
    'netlify',
    'deploy',
    '--prod',
    '--dir=dist',
    '--site',
    target.siteId,
    '--message',
    message,
  ],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
)

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 0)
