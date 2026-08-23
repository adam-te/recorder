import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const ARIA_DIRECTORY = join(SCRIPT_DIRECTORY, '..')
const ROOT_DIRECTORY = join(ARIA_DIRECTORY, '..')
const VENDOR_DIRECTORY = join(ARIA_DIRECTORY, 'vendor', 'playwright')
const PLAYWRIGHT_LICENSE = join(ARIA_DIRECTORY, 'PLAYWRIGHT-LICENSE')
const VENDOR_FILES = [
  ['packages/injected/src/ariaSnapshot.ts', 'injected/ariaSnapshot.ts'],
  ['packages/injected/src/roleUtils.ts', 'injected/roleUtils.ts'],
  ['packages/injected/src/domUtils.ts', 'injected/domUtils.ts'],
  ['packages/playwright-core/src/utils/isomorphic/ariaSnapshot.ts', 'isomorphic/ariaSnapshot.ts'],
  ['packages/playwright-core/src/utils/isomorphic/stringUtils.ts', 'isomorphic/stringUtils.ts'],
  ['packages/playwright-core/src/utils/isomorphic/cssTokenizer.ts', 'isomorphic/cssTokenizer.ts'],
  ['packages/playwright-core/src/utils/isomorphic/yaml.ts', 'isomorphic/yaml.ts'],
]
const IMPORT_REWRITES = {
  'injected/ariaSnapshot.ts': {
    '@isomorphic/ariaSnapshot': '../isomorphic/ariaSnapshot.ts',
    '@isomorphic/stringUtils': '../isomorphic/stringUtils.ts',
    '@isomorphic/yaml': '../isomorphic/yaml.ts',
    './domUtils': './domUtils.ts',
    './roleUtils': './roleUtils.ts',
  },
  'injected/roleUtils.ts': {
    '@isomorphic/ariaSnapshot': '../isomorphic/ariaSnapshot.ts',
    '@isomorphic/cssTokenizer': '../isomorphic/cssTokenizer.ts',
    './domUtils': './domUtils.ts',
  },
}
const MODIFICATION_NOTICE = '// Modified from the Playwright source only to use local TypeScript import paths.\n'

await generate()

async function generate() {
  const playwrightVersion = await readAndValidatePlaywrightVersion()
  const playwrightRawBaseUrl = `https://raw.githubusercontent.com/microsoft/playwright/v${playwrightVersion}`
  const [license, ...sources] = await Promise.all([download(`${playwrightRawBaseUrl}/LICENSE`), ...VENDOR_FILES.map(([source]) => download(`${playwrightRawBaseUrl}/${source}`))])

  await Promise.all([
    writeFile(PLAYWRIGHT_LICENSE, license),
    ...sources.map(async (contents, index) => {
      const destination = VENDOR_FILES[index][1]
      const path = join(VENDOR_DIRECTORY, destination)

      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, rewriteImports(contents, destination))
    }),
  ])
  process.stdout.write(`Vendored Playwright ARIA sources from Playwright ${playwrightVersion}\n`)
}

function rewriteImports(contents, destination) {
  const rewrites = IMPORT_REWRITES[destination]

  if (!rewrites) {
    return contents
  }
  for (const [source, replacement] of Object.entries(rewrites)) {
    const original = `from '${source}'`

    if (!contents.includes(original)) {
      throw new Error(`Expected ${destination} to import ${source}`)
    }
    contents = contents.replace(original, `from '${replacement}'`)
  }

  return MODIFICATION_NOTICE + contents
}

async function readAndValidatePlaywrightVersion() {
  const [rootPackage, ariaPackage] = await Promise.all([readJson(join(ROOT_DIRECTORY, 'package.json')), readJson(join(ARIA_DIRECTORY, 'package.json'))])
  const workspacePackages = await Promise.all(
    rootPackage.workspaces.map(async directory => ({
      directory,
      package: await readJson(join(ROOT_DIRECTORY, directory, 'package.json')),
    })),
  )
  const playwrightVersion = ariaPackage.devDependencies?.playwright
  const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

  if (!exactVersion.test(playwrightVersion ?? '')) {
    throw new Error('Expected an exact playwright version in the ARIA dev dependencies')
  }
  for (const { directory, package: workspacePackage } of workspacePackages) {
    for (const dependencyType of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      const version = workspacePackage[dependencyType]?.playwright

      if (version && version !== playwrightVersion) {
        throw new Error(`Playwright version mismatch: ARIA uses ${playwrightVersion}, but ${workspacePackage.name ?? directory} has ${version} in ${dependencyType}`)
      }
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
