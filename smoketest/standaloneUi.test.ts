import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { createRecordingDocument, serializeRecordingDocument, type RecordingDocument } from '@te/recorder-core'

import { resolveRecordingDirectoryPath, runRecorderCli } from '../cli/runRecorderCli/index.ts'
import { parseRecorderCliCommand } from '../cli/runRecorderCli/parseRecorderCliCommand.ts'
import { runRecordingEditor } from '../cli/ui/runRecordingEditor.ts'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
})

describe('standalone recording editor', () => {
  test('parses record commands with an optional recording directory', () => {
    expect(parseRecorderCliCommand(['record', 'https://example.com'])).toEqual({ directoryPath: undefined, kind: 'record', url: 'https://example.com' })
    expect(parseRecorderCliCommand(['record', 'https://example.com', 'custom.recording'])).toEqual({ directoryPath: 'custom.recording', kind: 'record', url: 'https://example.com' })
    expect(() => parseRecorderCliCommand(['record'])).toThrow('Usage: te record <url> [recording-directory]')
  })

  test('parses the ui command', () => {
    expect(parseRecorderCliCommand(['ui', 'example.recording'])).toEqual({ directoryPath: 'example.recording', kind: 'ui' })
    expect(() => parseRecorderCliCommand(['ui'])).toThrow('Usage: te ui <directory>')
  })

  test('chooses an available hostname-based recording directory', async () => {
    const workingDirectory = await createTemporaryDirectory()

    expect(await resolveRecordingDirectoryPath({ url: 'https://www.example.com/path', workingDirectory })).toBe(join(workingDirectory, 'example.recording'))
    await mkdir(join(workingDirectory, 'example.recording'))
    expect(await resolveRecordingDirectoryPath({ url: 'https://example.com', workingDirectory })).toBe(join(workingDirectory, 'example-2.recording'))
  })

  test('saves a CLI recording and opens it in the editor', async () => {
    const workingDirectory = await createTemporaryDirectory()
    const document = createRecordingDocument({ startUrl: 'https://example.com', title: 'Example recording' })
    const openedDirectories: string[] = []
    const output: string[] = []
    const exitCode = await runRecorderCli({
      argv: ['record', 'https://example.com'],
      recorder: {
        dispose: async () => undefined,
        play: async () => undefined,
        start: async () => undefined,
        stop: async () => document,
      },
      runRecordingEditor: async args => {
        openedDirectories.push(args.directoryPath)
      },
      stdout: { write: value => output.push(value) },
      waitForStop: async () => undefined,
      workingDirectory,
    })
    const directoryPath = join(workingDirectory, 'example.recording')

    expect(exitCode).toBe(0)
    expect(openedDirectories).toEqual([directoryPath])
    expect(JSON.parse(await readFile(join(directoryPath, 'recording.json'), 'utf8'))).toEqual(JSON.parse(serializeRecordingDocument(document)))
    expect(output.join('')).toContain(`Recording to ${directoryPath}.`)
    expect(output.join('')).toContain(`Saved recording to ${directoryPath}.`)
  })

  test('serves a recording and handles editor messages', async () => {
    const directoryPath = await createRecordingDirectory()
    const onPlay = vi.fn<(document: RecordingDocument) => Promise<void>>(async () => undefined)
    const output: string[] = []

    await runRecordingEditor({
      directoryPath,
      onPlay,
      openBrowser: async url => {
        const browser = await chromium.launch({ headless: true })

        try {
          const page = await browser.newPage()
          const pageResponse = await page.goto(url)
          expect(pageResponse?.status()).toBe(200)
          expect(await page.locator('h1').textContent()).toBe('Example recording')

          const assetResponse = await page.request.get(new URL('recordingEditor.js', url).href)
          expect(assetResponse.status()).toBe(200)
          expect(assetResponse.headers()['x-content-type-options']).toBe('nosniff')

          const playResponse = page.waitForResponse(response => response.url().endsWith('/api/messages'))
          await page.getByRole('button', { name: 'Play' }).click()
          expect((await playResponse).status()).toBe(200)
        } finally {
          await browser.close()
        }
      },
      stdout: { write: value => output.push(value) },
    })

    expect(onPlay).toHaveBeenCalledOnce()
    expect(output.join('')).toContain('Recording editor opened at http://127.0.0.1:')
  })
})

async function createRecordingDirectory(): Promise<string> {
  const temporaryDirectory = await createTemporaryDirectory()
  const directoryPath = join(temporaryDirectory, 'example.recording')
  await mkdir(directoryPath)
  await writeFile(join(directoryPath, 'recording.json'), serializeRecordingDocument(createRecordingDocument({ startUrl: 'https://example.com', title: 'Example recording' })))

  return directoryPath
}

async function createTemporaryDirectory(): Promise<string> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'recorder-standalone-ui-'))
  temporaryDirectories.push(temporaryDirectory)

  return temporaryDirectory
}
