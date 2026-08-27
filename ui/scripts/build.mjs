import { build } from 'esbuild'

import { svelteEsbuildPlugin } from '../../scripts/svelteEsbuildPlugin.mjs'

await build({
  bundle: true,
  entryPoints: ['standalone/recordingEditor.ts'],
  format: 'esm',
  outfile: 'dist/standalone/recordingEditor.js',
  platform: 'browser',
  plugins: [svelteEsbuildPlugin],
})
