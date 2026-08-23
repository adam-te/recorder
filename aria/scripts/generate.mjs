import { build } from 'esbuild'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const ARIA_DIRECTORY = join(SCRIPT_DIRECTORY, '..')
const ROOT_DIRECTORY = join(ARIA_DIRECTORY, '..')
const GENERATED_DIRECTORY = join(ARIA_DIRECTORY, 'generated')
const SNAPSHOT_MODULE = join(GENERATED_DIRECTORY, 'playwrightAriaSnapshot.js')
const SNAPSHOT_TYPES = join(GENERATED_DIRECTORY, 'playwrightAriaSnapshot.d.ts')
const PLAYWRIGHT_LICENSE = join(ARIA_DIRECTORY, 'PLAYWRIGHT-LICENSE')
const VIRTUAL_ENTRY = 'playwright-aria-entry'
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

  interface AriaSnapshotOptions {
    target: Element
  }

  interface AriaSnapshot {
    snapshot: string
    targetRef?: string
  }

  export function generateAriaSnapshot(options: AriaSnapshotOptions): AriaSnapshot {
    const root = options.target.ownerDocument.body ?? options.target.ownerDocument.documentElement

    if (!root) {
      return { snapshot: '' }
    }

    const treeOptions = { mode: 'ai' } as const
    const tree = generateAriaTree(root, treeOptions)

    return { snapshot: renderAriaTree(tree, treeOptions).text, targetRef: tree.refs.get(options.target) }
  }
`

await generate()

async function generate() {
  const playwrightVersion = await readAndValidatePlaywrightVersion()
  const playwrightRawBaseUrl = `https://raw.githubusercontent.com/microsoft/playwright/v${playwrightVersion}`
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'recorder-playwright-aria-'))

  try {
    const [license] = await Promise.all([
      download(`${playwrightRawBaseUrl}/LICENSE`),
      ...VENDOR_FILES.map(async ([source, destination]) => {
        const contents = await download(`${playwrightRawBaseUrl}/${source}`)
        const path = join(temporaryDirectory, destination)

        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, contents)
      }),
    ])
    const snapshotSource = await buildSnapshot(temporaryDirectory, playwrightVersion)
    const declarationSource = `import type { AriaSnapshot, AriaSnapshotOptions } from '../types.ts'\n\nexport declare function generateAriaSnapshot(options: AriaSnapshotOptions): AriaSnapshot\n`

    await mkdir(GENERATED_DIRECTORY, { recursive: true })
    await Promise.all([writeFile(SNAPSHOT_MODULE, snapshotSource), writeFile(SNAPSHOT_TYPES, declarationSource), writeFile(PLAYWRIGHT_LICENSE, license)])
    process.stdout.write(`Generated ARIA snapshot from Playwright ${playwrightVersion}\n`)
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true })
  }
}

async function buildSnapshot(temporaryDirectory, playwrightVersion) {
  const virtualEntryPath = join(temporaryDirectory, 'entry.ts')
  const result = await build({
    banner: { js: `/*! @generated from Playwright ${playwrightVersion} | Apache-2.0 | Copyright Microsoft Corporation */` },
    bundle: true,
    entryPoints: [VIRTUAL_ENTRY],
    format: 'esm',
    legalComments: 'none',
    minify: true,
    platform: 'browser',
    plugins: [
      {
        name: 'playwright-source-aliases',
        setup(buildContext) {
          buildContext.onResolve({ filter: new RegExp(`^${VIRTUAL_ENTRY}$`) }, () => ({ path: virtualEntryPath }))
          buildContext.onLoad({ filter: /entry\.ts$/ }, () => ({ contents: ENTRY_SOURCE, loader: 'ts' }))
          buildContext.onResolve({ filter: /^@isomorphic\// }, args => ({ path: join(temporaryDirectory, 'isomorphic', `${args.path.slice('@isomorphic/'.length)}.ts`) }))
          buildContext.onResolve({ filter: /^yaml$/ }, () => ({ namespace: 'yaml-type-stub', path: 'yaml' }))
          buildContext.onLoad({ filter: /.*/, namespace: 'yaml-type-stub' }, () => ({ contents: 'export {}', loader: 'ts' }))
        },
      },
    ],
    target: 'es2022',
    write: false,
  })

  return result.outputFiles[0].text
}

async function readAndValidatePlaywrightVersion() {
  const packagePaths = ['aria', 'cli', 'extension', 'runtime', 'smoketest'].map(directory => join(ROOT_DIRECTORY, directory, 'package.json'))
  const [ariaPackage, cliPackage, extensionPackage, runtimePackage, smoketestPackage] = await Promise.all(packagePaths.map(readJson))
  const playwrightVersion = ariaPackage.devDependencies?.playwright
  const consumerVersions = {
    cli: cliPackage.dependencies?.playwright,
    extension: extensionPackage.dependencies?.playwright,
    runtime: runtimePackage.peerDependencies?.playwright,
    smoketest: smoketestPackage.dependencies?.playwright,
  }
  const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

  if (!exactVersion.test(playwrightVersion ?? '')) {
    throw new Error('Expected an exact playwright version in the ARIA dev dependencies')
  }
  for (const [consumer, version] of Object.entries(consumerVersions)) {
    if (version !== playwrightVersion) {
      throw new Error(`Playwright version mismatch: ARIA uses ${playwrightVersion}, but ${consumer} uses ${version ?? 'nothing'}`)
    }
  }

  return playwrightVersion
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function download(url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }

  return response.text()
}
