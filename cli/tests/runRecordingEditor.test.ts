import { runRecordingEditor } from '#cli/ui/runRecordingEditor.ts'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, test, vi } from 'vitest'

import { createRecording, serializeRecording, serializeRecordingSnapshot, type Recording } from '@te/recorder-core'
import { tryTo } from '@te/recorder-utils'

import { useTemporaryDirectories } from './support/temporaryDirectories.ts'

describe('runRecordingEditor', () => {
  const temporaryDirectories = useTemporaryDirectories()

  test('serves a recording and handles editor messages', async () => {
    const temporaryDirectory = await temporaryDirectories.create()
    const directoryPath = join(temporaryDirectory, 'example.recording')
    const recording: Recording = {
      ...createRecording({ startUrl: 'https://example.com', title: 'Example recording' }),
      actions: [
        {
          kind: 'click',
          locatorCandidates: [
            {
              kind: 'aria',
              steps: [
                { exact: true, method: 'role', name: 'Settings', role: 'dialog' },
                { exact: false, method: 'label', text: 'Save' },
              ],
            },
          ],
          pageUrl: 'https://example.com',
        },
      ],
    }
    await mkdir(join(directoryPath, 'snapshots'), { recursive: true })
    await writeFile(join(directoryPath, 'recording.json'), serializeRecording(recording))
    await writeFile(
      join(directoryPath, 'snapshots', '0000.aria.json'),
      serializeRecordingSnapshot({
        children: [
          { name: 'Show [ref=e2]', props: {}, ref: 'e1', role: 'button' },
          { cursor: 'pointer', name: 'Save', props: {}, ref: 'e2', role: 'button', target: true },
        ],
        name: '',
        props: {},
        role: 'fragment',
      }),
    )

    const onPlay = vi.fn<(recording: Recording) => Promise<void>>(async () => undefined)
    const output: string[] = []

    await runRecordingEditor({
      directoryPath,
      onPlay,
      openBrowser: async url => {
        const browser = await chromium.launch({ headless: true })

        await tryTo(
          async () => {
            const page = await browser.newPage()
            await page.goto(url)
            expect(await page.locator('h1').textContent()).toBe('Example recording')
            expect(await page.locator('.locator-list').textContent()).toContain('page.getByRole("dialog", { name: "Settings", exact: true }).getByLabel("Save", { exact: false })')
            expect(await page.locator('.snapshot-yaml').textContent()).toContain('Show [ref=e2]')
            expect(await page.locator('.snapshot-yaml').textContent()).not.toContain('[ref=e1]')
            expect(await page.locator('.target-line').textContent()).toContain('Save')

            const assetResponse = await page.request.get(new URL('recordingEditor.js', url).href)
            expect(assetResponse.status()).toBe(200)
            expect(assetResponse.headers()['x-content-type-options']).toBe('nosniff')

            const playResponse = page.waitForResponse(response => response.url().endsWith('/api/messages'))
            await page.getByRole('button', { name: 'Play' }).click()
            await playResponse
          },
          undefined,
          () => browser.close(),
        )
      },
      stdout: { write: value => output.push(value) },
    })

    expect(onPlay).toHaveBeenCalledOnce()
    expect(output.join('')).toContain('Recording editor opened at http://127.0.0.1:')
  })
})
