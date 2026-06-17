import { spawnSync } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const sourceDir = `${projectRoot}/tmp/body-texture-sources`
const assetDir = `${projectRoot}/src/assets/bodies`
const magick = process.env.MAGICK_BIN ?? 'magick'

const sources = {
  earth: {
    url: 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/august/world.200408.3x5400x2700.jpg',
    path: `${sourceDir}/earth-blue-marble-august-5400x2700.jpg`,
  },
  moon: {
    url: 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg',
    path: `${sourceDir}/moon-cgi-kit-lroc-color-2k.jpg`,
  },
}

const outputs = {
  earth: `${assetDir}/earth-stylized.webp`,
  moon: `${assetDir}/moon-stylized.webp`,
}

const checkCommand = (command, installHint) => {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' })

  if (result.status !== 0) {
    const errorDetail = result.error ? ` (${result.error.message})` : ''
    throw new Error(
      `Missing required command: ${command}. ${installHint}${errorDetail}`,
    )
  }
}

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    const errorDetail = result.error ? ` (${result.error.message})` : ''
    throw new Error(
      `Command failed: ${command} ${args.join(' ')}${errorDetail}`,
    )
  }
}

const download = ({ path, url }) => {
  run('curl', ['--fail', '--location', '--output', path, url])
}

checkCommand('curl', 'Install it before regenerating body textures.')
checkCommand(
  magick,
  'Install ImageMagick or set MAGICK_BIN when using a custom binary.',
)

await mkdir(sourceDir, { recursive: true })
await mkdir(assetDir, { recursive: true })

download(sources.earth)
download(sources.moon)

run(magick, [
  sources.earth.path,
  '-resize',
  '2048x1024!',
  '-colorspace',
  'sRGB',
  '-blur',
  '0x0.45',
  '-modulate',
  '112,74,100',
  '-sigmoidal-contrast',
  '-4x50%',
  '-fill',
  '#2f7ea3',
  '-colorize',
  '10',
  '-colors',
  '80',
  '-strip',
  '-quality',
  '82',
  '-define',
  'webp:method=6',
  outputs.earth,
])

run(magick, [
  sources.moon.path,
  '-resize',
  '2048x1024!',
  '-colorspace',
  'sRGB',
  '-blur',
  '0x0.15',
  '-modulate',
  '108,55,100',
  '-sigmoidal-contrast',
  '-1.5x50%',
  '-fill',
  '#b3a9a0',
  '-colorize',
  '8',
  '-colors',
  '96',
  '-strip',
  '-quality',
  '82',
  '-define',
  'webp:method=6',
  outputs.moon,
])
