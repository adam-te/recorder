import { runRecordingEditor } from '#cli/ui/runRecordingEditor.ts'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type Page } from 'playwright'
import { describe, expect, test, vi } from 'vitest'

import { createRecording, serializeRecording, serializeRecordingSnapshot, type Recording } from '@te/recorder-core'
import { tryTo } from '@te/recorder-utils'

import { useTemporaryDirectories } from './support/temporaryDirectories.ts'

describe('runRecordingEditor', () => {
  const temporaryDirectories = useTemporaryDirectories()

  test('renders the recording', async () => {
    await runEditor(await temporaryDirectories.create(), async page => {
      expect(await page.locator('h1').textContent()).toBe('Example recording')
      expect(await page.locator('.locator-list').textContent()).toContain('page.getByRole("dialog", { name: "Settings", exact: true }).getByLabel("Save", { exact: false })')
    })
  })

  test('renders the snapshot with its target distinguished', async () => {
    await runEditor(await temporaryDirectories.create(), async page => {
      expect(await page.locator('.snapshot-yaml').textContent()).toContain('Show [ref=e2]')
      expect(await page.locator('.snapshot-yaml').textContent()).not.toContain('[ref=e1]')
      expect(await page.locator('.target-line').textContent()).toContain('Save')
    })
  })

  test('serves editor assets with content sniffing disabled', async () => {
    await runEditor(await temporaryDirectories.create(), async (page, url) => {
      const response = await page.request.get(new URL('recordingEditor.js', url).href)

      expect(response.status()).toBe(200)
      expect(response.headers()['x-content-type-options']).toBe('nosniff')
    })
  })

  test('plays the recording from the editor', async () => {
    const result = await runEditor(await temporaryDirectories.create(), async page => {
      const playResponse = page.waitForResponse(response => response.url().endsWith('/api/messages'))

      await page.getByRole('button', { name: 'Play' }).click()
      await playResponse
    })

    expect(result.onPlay).toHaveBeenCalledOnce()
  })

  test('prints the editor URL', async () => {
    expect((await runEditor(await temporaryDirectories.create(), async () => undefined)).output.join('')).toContain('Recording editor opened at http://127.0.0.1:')
  })
})

async function runEditor(temporaryDirectory: string, inspect: (page: Page, url: string) => Promise<void>): Promise<EditorResult> {
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
  const onPlay = vi.fn<(recording: Recording) => Promise<void>>(async () => undefined)
  const output: string[] = []

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
  await runRecordingEditor({
    directoryPath,
    onPlay,
    openBrowser: async url => {
      const browser = await chromium.launch({ headless: true })

      await tryTo(
        async () => {
          const page = await browser.newPage()

          await page.goto(url)
          await inspect(page, url)
        },
        undefined,
        () => browser.close(),
      )
    },
    stdout: { write: value => output.push(value) },
  })

  return { onPlay, output }
}

interface EditorResult {
  onPlay: ReturnType<typeof vi.fn<(recording: Recording) => Promise<void>>>
  output: string[]
}
