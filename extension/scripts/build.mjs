import { build, context } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
import { format } from 'oxfmt'

const watch = process.argv.includes('--watch')
const sourcemap = process.argv.includes('--sourcemap')
const formatWebviewAssetsPlugin = {
  name: 'format-webview-assets',
  setup(buildContext) {
    buildContext.onEnd(async result => {
      if (result.errors.length > 0) return

      await Promise.all(['media/recordingEditor.css', 'media/recordingEditor.js'].map(formatAsset))
    })
  },
}
const configurations = [
  {
    bundle: true,
    define: { 'import.meta.vitest': 'false' },
    entryPoints: ['index.ts'],
    external: ['playwright', 'vscode'],
    format: 'cjs',
    outfile: 'dist/extension.cjs',
    platform: 'node',
    sourcemap,
  },
  {
    bundle: true,
    entryPoints: ['webview/recordingEditor.ts'],
    format: 'esm',
    outfile: 'media/recordingEditor.js',
    platform: 'browser',
    plugins: [formatWebviewAssetsPlugin],
    sourcemap,
  },
]

async function formatAsset(fileName) {
  const source = await readFile(fileName, 'utf8')
  const result = await format(fileName, source, { arrowParens: 'avoid', objectWrap: 'preserve', printWidth: 320, semi: false, singleQuote: true })
  if (result.errors.length > 0) throw new Error(`Could not format ${fileName}: ${result.errors.map(error => error.message).join(', ')}`)
  await writeFile(fileName, result.code)
}

if (watch) {
  console.log('[watch] build started')
  const contexts = await Promise.all(configurations.map(configuration => context(configuration)))
  await Promise.all(contexts.map(buildContext => buildContext.watch()))
  console.log('[watch] build finished, watching for changes...')
} else {
  await Promise.all(configurations.map(configuration => build(configuration)))
}
