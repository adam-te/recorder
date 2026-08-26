import { build, context } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { format } from 'oxfmt'
import { compile } from 'svelte/compiler'

const watch = process.argv.includes('--watch')
const sourcemap = process.argv.includes('--sourcemap')
const sveltePlugin = {
  name: 'svelte',
  setup(buildContext) {
    buildContext.onLoad({ filter: /\.svelte$/ }, async args => {
      const { js, warnings } = compile(await readFile(args.path, 'utf8'), {
        filename: args.path,
        generate: 'client',
        modernAst: true,
        runes: true,
      })

      return {
        contents: js.code,
        loader: 'js',
        resolveDir: dirname(args.path),
        warnings: warnings.map(warning => ({ text: warning.message })),
      }
    })
  },
}
const formatWebviewAssetsPlugin = {
  name: 'format-webview-assets',
  setup(buildContext) {
    buildContext.onEnd(async result => {
      if (result.errors.length > 0) return

      await Promise.all(['dist/webview/recordingEditor.css', 'dist/webview/recordingEditor.js'].map(formatAsset))
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
    outfile: 'dist/webview/recordingEditor.js',
    platform: 'browser',
    plugins: [sveltePlugin, formatWebviewAssetsPlugin],
    sourcemap,
  },
]

async function formatAsset(fileName) {
  const result = await format(fileName, await readFile(fileName, 'utf8'), { arrowParens: 'avoid', objectWrap: 'preserve', printWidth: 320, semi: false, singleQuote: true })
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
