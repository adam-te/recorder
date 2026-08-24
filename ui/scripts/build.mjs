import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { compile } from 'svelte/compiler'

const sveltePlugin = {
  name: 'svelte',
  setup(buildContext) {
    buildContext.onLoad({ filter: /\.svelte$/ }, async args => {
      const source = await readFile(args.path, 'utf8')
      const { js, warnings } = compile(source, { filename: args.path, generate: 'client', modernAst: true, runes: true })

      return {
        contents: js.code,
        loader: 'js',
        resolveDir: dirname(args.path),
        warnings: warnings.map(warning => ({ text: warning.message })),
      }
    })
  },
}

await build({
  bundle: true,
  entryPoints: ['standalone/recordingEditor.ts'],
  format: 'esm',
  outfile: 'dist/standalone/recordingEditor.js',
  platform: 'browser',
  plugins: [sveltePlugin],
})
