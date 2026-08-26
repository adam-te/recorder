import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const ARIA_DIRECTORY = join(SCRIPT_DIRECTORY, '..')
const ROOT_DIRECTORY = join(ARIA_DIRECTORY, '..')
const VENDOR_DIRECTORY = join(ARIA_DIRECTORY, 'vendor', 'playwright')
const PLAYWRIGHT_LICENSE = join(ARIA_DIRECTORY, 'PLAYWRIGHT-LICENSE')
const VENDOR_FILES = [
  ['packages/injected/src/ariaSnapshot.ts', 'injected/ariaSnapshot.ts'],
  ['packages/injected/src/ariaSnapshotDistiller.ts', 'injected/ariaSnapshotDistiller.ts'],
  ['packages/injected/src/roleUtils.ts', 'injected/roleUtils.ts'],
  ['packages/injected/src/selectorUtils.ts', 'injected/selectorUtils.ts'],
  ['packages/injected/src/domUtils.ts', 'injected/domUtils.ts'],
  ['packages/isomorphic/ariaSnapshot.ts', 'isomorphic/ariaSnapshot.ts'],
  ['packages/isomorphic/cssParser.ts', 'isomorphic/cssParser.ts'],
  ['packages/isomorphic/stringUtils.ts', 'isomorphic/stringUtils.ts'],
  ['packages/isomorphic/cssTokenizer.ts', 'isomorphic/cssTokenizer.ts'],
  ['packages/isomorphic/selectorParser.ts', 'isomorphic/selectorParser.ts'],
  ['packages/isomorphic/yaml.ts', 'isomorphic/yaml.ts'],
]
const VENDOR_DESTINATIONS = new Map(VENDOR_FILES.map(([source, destination]) => [withoutExtension(source), destination]))
const MODIFICATION_NOTICE = '// Modified from the Playwright source only to use local TypeScript import paths.\n'

await generate()

async function generate() {
  const playwrightVersion = await readAndValidatePlaywrightVersion()
  const playwrightRawBaseUrl = `https://raw.githubusercontent.com/microsoft/playwright/v${playwrightVersion}`
  const [license, ...sources] = await Promise.all([download(`${playwrightRawBaseUrl}/LICENSE`), ...VENDOR_FILES.map(([source]) => download(`${playwrightRawBaseUrl}/${source}`))])

  await Promise.all([
    writeFile(PLAYWRIGHT_LICENSE, license),
    ...sources.map(async (contents, index) => {
      const [source, destination] = VENDOR_FILES[index]
      const path = join(VENDOR_DIRECTORY, destination)

      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, rewriteImports(contents, source, destination))
    }),
  ])
  process.stdout.write(`Vendored Playwright ARIA sources from Playwright ${playwrightVersion}\n`)
}

function rewriteImports(contents, source, destination) {
  const rewrites = []

  for (const { fileName, pos, end } of ts.preProcessFile(contents, true, true).importedFiles) {
    const importedSource = resolveImport(source, fileName)

    if (!importedSource) {
      continue
    }
    const importedDestination = VENDOR_DESTINATIONS.get(importedSource)

    if (!importedDestination) {
      throw new Error(`${source} imports ${fileName}, which is not included in VENDOR_FILES`)
    }
    rewrites.push({ pos, end, replacement: relativeImport(destination, importedDestination) })
  }
  if (!rewrites.length) {
    return contents
  }
  for (const { pos, end, replacement } of rewrites.toReversed()) {
    contents = contents.slice(0, pos + 1) + replacement + contents.slice(end + 1)
  }

  return MODIFICATION_NOTICE + contents
}

function resolveImport(source, specifier) {
  if (specifier.startsWith('@isomorphic/')) {
    return withoutExtension(`packages/${specifier.slice(1)}`)
  }
  if (!specifier.startsWith('.')) {
    return
  }

  return withoutExtension(posix.join(posix.dirname(source), specifier))
}

function relativeImport(source, importedSource) {
  const relative = posix.relative(posix.dirname(source), importedSource)

  return relative.startsWith('.') ? relative : `./${relative}`
}

function withoutExtension(path) {
  return path.replace(/\.[cm]?[jt]sx?$/, '')
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

  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(playwrightVersion ?? '')) {
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
