const { build } = require('esbuild')
const { mkdir, mkdtemp, rm, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const PLAYWRIGHT_VERSION = '1.59.1'
const PLAYWRIGHT_TAG = `v${PLAYWRIGHT_VERSION}`
const PLAYWRIGHT_RAW_BASE_URL = `https://raw.githubusercontent.com/microsoft/playwright/${PLAYWRIGHT_TAG}`
const GENERATED_DIRECTORY = join(__dirname, 'generated')
const GENERATED_MODULE = join(GENERATED_DIRECTORY, 'playwrightAriaSnapshot.js')
const GENERATED_TYPES = join(GENERATED_DIRECTORY, 'playwrightAriaSnapshot.d.ts')
const PLAYWRIGHT_LICENSE = join(__dirname, 'PLAYWRIGHT-LICENSE')
const VENDOR_FILES = [
  ['packages/injected/src/ariaSnapshot.ts', 'injected/ariaSnapshot.ts'],
  ['packages/injected/src/roleUtils.ts', 'injected/roleUtils.ts'],
  ['packages/injected/src/domUtils.ts', 'injected/domUtils.ts'],
  ['packages/playwright-core/src/utils/isomorphic/ariaSnapshot.ts', 'isomorphic/ariaSnapshot.ts'],
  ['packages/playwright-core/src/utils/isomorphic/stringUtils.ts', 'isomorphic/stringUtils.ts'],
  ['packages/playwright-core/src/utils/isomorphic/cssTokenizer.ts', 'isomorphic/cssTokenizer.ts'],
  ['packages/playwright-core/src/utils/isomorphic/yaml.ts', 'isomorphic/yaml.ts'],
]
const ENTRY_SOURCE = `
  import { generateAriaTree, renderAriaTree } from './injected/ariaSnapshot'

  interface AriaTraversalOptions {
    target: Element
  }

  interface AriaSnapshot {
    snapshot: string
    targetRef?: string
  }

  export function generateAriaSnapshot(options: AriaTraversalOptions): AriaSnapshot {
    const root = options.target.ownerDocument.body ?? options.target.ownerDocument.documentElement

    if (!root) {
      return { snapshot: '' }
    }

    const treeOptions = { mode: 'ai' } as const
    const tree = generateAriaTree(root, treeOptions)

    return { snapshot: renderAriaTree(tree, treeOptions).text, targetRef: tree.refs.get(options.target) }
  }
`
const DECLARATION_SOURCE = `import type { AriaSnapshot, AriaTraversalOptions } from '../types.ts'

export declare function generateAriaSnapshot(options: AriaTraversalOptions): AriaSnapshot
`

void generate()

async function generate() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'recorder-playwright-aria-'))

  try {
    await Promise.all(VENDOR_FILES.map(([source, destination]) => download(`${PLAYWRIGHT_RAW_BASE_URL}/${source}`, join(temporaryDirectory, destination))))
    await writeFile(join(temporaryDirectory, 'entry.ts'), ENTRY_SOURCE)
    const result = await build({
      banner: { js: `/*! @generated from Playwright ${PLAYWRIGHT_VERSION} | Apache-2.0 | Copyright Microsoft Corporation */` },
      bundle: true,
      entryPoints: [join(temporaryDirectory, 'entry.ts')],
      format: 'esm',
      legalComments: 'none',
      minify: true,
      platform: 'browser',
      plugins: [
        {
          name: 'playwright-source-aliases',
          setup(buildContext) {
            buildContext.onResolve({ filter: /^@isomorphic\// }, args => ({ path: join(temporaryDirectory, 'isomorphic', `${args.path.slice('@isomorphic/'.length)}.ts`) }))
            buildContext.onResolve({ filter: /^yaml$/ }, () => ({ namespace: 'yaml-type-stub', path: 'yaml' }))
            buildContext.onLoad({ filter: /.*/, namespace: 'yaml-type-stub' }, () => ({ contents: 'export {}', loader: 'ts' }))
          },
        },
      ],
      target: 'es2022',
      write: false,
    })

    await mkdir(GENERATED_DIRECTORY, { recursive: true })
    await Promise.all([writeFile(GENERATED_MODULE, result.outputFiles[0].text), writeFile(GENERATED_TYPES, DECLARATION_SOURCE), download(`${PLAYWRIGHT_RAW_BASE_URL}/LICENSE`, PLAYWRIGHT_LICENSE)])
    process.stdout.write(`Generated ${GENERATED_MODULE} from Playwright ${PLAYWRIGHT_VERSION}\n`)
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true })
  }
}

async function download(url, destination) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }

  await mkdir(join(destination, '..'), { recursive: true })
  await writeFile(destination, await response.text())
}
