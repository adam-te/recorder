import { build } from 'esbuild'

import { svelteEsbuildPlugin } from '../../scripts/svelteEsbuildPlugin.mjs'

await build({
  bundle: true,
  entryPoints: ['ui/browser/recordingEditor.ts'],
  format: 'esm',
  outfile: 'dist/ui/recordingEditor.js',
  platform: 'browser',
  plugins: [svelteEsbuildPlugin],
})
