import { runRecordingEditor } from '#cli/ui/runRecordingEditor.ts'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, test, vi } from 'vitest'

import { createRecordingDocument, serializeRecordingDocument, type RecordingDocument } from '@te/recorder-core'

import { useTemporaryDirectories } from './support/temporaryDirectories.ts'

describe('runRecordingEditor', () => {
  const temporaryDirectories = useTemporaryDirectories()

  test('serves a recording and handles editor messages', async () => {
    const temporaryDirectory = await temporaryDirectories.create()
    const directoryPath = join(temporaryDirectory, 'example.recording')
    await mkdir(directoryPath)
    await writeFile(join(directoryPath, 'recording.json'), serializeRecordingDocument(createRecordingDocument({ startUrl: 'https://example.com', title: 'Example recording' })))

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
