import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import preact from '@preact/preset-vite'
import { defineConfig, type Plugin } from 'vite'
import { parse } from 'yaml'

const devtoolsVersionFileName = 'space-web-game-devtools-version.json'
const devtoolsManifestPath = fileURLToPath(
  new URL('./extension/space-web-game-devtools/manifest.json', import.meta.url),
)

const getDevtoolsVersionPayload = () => {
  const manifest = JSON.parse(readFileSync(devtoolsManifestPath, 'utf8')) as {
    version?: unknown
  }

  if (typeof manifest.version !== 'string') {
    throw new Error('DevTools extension manifest is missing a string version')
  }

  return `${JSON.stringify({ extensionVersion: manifest.version }, null, 2)}\n`
}

const yamlConfigPlugin = (): Plugin => ({
  name: 'space-game-yaml-config',
  enforce: 'pre',
  transform(source, id) {
    if (!id.endsWith('.yml') && !id.endsWith('.yaml')) {
      return null
    }

    return {
      code: `export default ${JSON.stringify(parse(source) ?? {})};`,
      map: null,
    }
  },
})

const devtoolsVersionPlugin = (): Plugin => ({
  name: 'space-game-devtools-version',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const pathname = request.url?.split('?')[0]

      if (pathname !== `/${devtoolsVersionFileName}`) {
        next()
        return
      }

      response.setHeader('Content-Type', 'application/json')
      response.end(getDevtoolsVersionPayload())
    })
  },
  generateBundle() {
    this.emitFile({
      fileName: devtoolsVersionFileName,
      source: getDevtoolsVersionPayload(),
      type: 'asset',
    })
  },
})

export default defineConfig({
  plugins: [preact(), yamlConfigPlugin(), devtoolsVersionPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
