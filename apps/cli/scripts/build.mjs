import { build } from 'esbuild'

import { svelteEsbuildPlugin } from '@te/recorder-utils/build/svelte-esbuild-plugin'

await build({
  bundle: true,
  entryPoints: ['ui/browser/recordingEditor.ts'],
  format: 'esm',
  outfile: 'dist/ui/recordingEditor.js',
  platform: 'browser',
  plugins: [svelteEsbuildPlugin],
})
