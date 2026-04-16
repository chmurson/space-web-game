import { execFileSync, spawnSync } from 'node:child_process'

const PRODUCTION_SITE_ID = '0ed821be-c897-4f15-ad17-859ae866ca1d'
const STAGING_SITE_ID = 'e0d8dda6-9340-4d3c-9e78-941ccbb63d5f'

const parseMode = () => {
  const modeFlag = process.argv.find((arg) => arg.startsWith('--mode='))
  if (!modeFlag) {
    return 'auto'
  }

  const [, value] = modeFlag.split('=')
  return value === 'production' || value === 'staging' ? value : 'auto'
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

const resolveTarget = (mode, branch) => {
  if (mode === 'production') {
    return {
      label: 'production',
      siteId: process.env.NETLIFY_PRODUCTION_SITE_ID || PRODUCTION_SITE_ID,
    }
  }

  if (mode === 'staging' || branch !== 'main') {
    return {
      label: 'staging',
      siteId: process.env.NETLIFY_STAGING_SITE_ID || STAGING_SITE_ID,
    }
  }

  return {
    label: 'production',
    siteId: process.env.NETLIFY_PRODUCTION_SITE_ID || PRODUCTION_SITE_ID,
  }
}

const mode = parseMode()
const branch = getCurrentBranch()
const commit = getCurrentCommit()
const target = resolveTarget(mode, branch)
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
