import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { createRecordingDocument, serializeRecordingDocument, type RecordingDocument } from '@te/recorder-core'

import { parseRecorderCliCommand } from '../cli/runRecorderCli/parseRecorderCliCommand.ts'
import { runRecordingEditor } from '../cli/ui/runRecordingEditor.ts'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { force: true, recursive: true })))
})

describe('standalone recording editor', () => {
  test('parses the ui command', () => {
    expect(parseRecorderCliCommand(['ui', 'example.recording'])).toEqual({ directoryPath: 'example.recording', kind: 'ui' })
    expect(() => parseRecorderCliCommand(['ui'])).toThrow('Usage: te ui <directory>')
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
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'recorder-standalone-ui-'))
  const directoryPath = join(temporaryDirectory, 'example.recording')
  temporaryDirectories.push(temporaryDirectory)
  await mkdir(directoryPath)
  await writeFile(join(directoryPath, 'recording.json'), serializeRecordingDocument(createRecordingDocument({ startUrl: 'https://example.com', title: 'Example recording' })))

  return directoryPath
}
