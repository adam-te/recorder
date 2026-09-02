import { runRecordingEditor } from '#cli/ui/runRecordingEditor.ts'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium, type Page } from 'playwright'
import { describe, expect, test, vi } from 'vitest'

import { createRecording, serializeRecording, serializeRecordingSnapshot, type Recording } from '@te/recorder-recording'
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
      await page.getByRole('tab', { name: 'Accessibility' }).click()
      expect(await page.locator('.snapshot-yaml').textContent()).toContain('Show [ref=e2]')
      expect(await page.locator('.snapshot-yaml').textContent()).not.toContain('[ref=e1]')
      expect(await page.locator('.target-line').textContent()).toContain('Save')
    })
  })

  test('renders the screenshot for the selected interaction', async () => {
    await runEditor(await temporaryDirectories.create(), async page => {
      const screenshot = page.getByRole('img', { name: 'Page captured for the selected step' })

      await screenshot.waitFor({ state: 'visible' })
      expect(await screenshot.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(1)
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

  test('generates and downloads ThousandEyes JavaScript', async () => {
    await runEditor(
      await temporaryDirectories.create(),
      async page => {
        await page.getByRole('tab', { name: 'ThousandEyes JS' }).click()
        expect(await page.locator('.script-source').textContent()).toContain('await driver.get("https://example.com/dashboard");')

        const download = page.waitForEvent('download')
        await page.getByRole('button', { name: 'Save .js' }).click()
        expect((await download).suggestedFilename()).toBe('example-recording.js')
        expect(await readFile(await (await download).path(), 'utf8')).toContain('await driver.get("https://example.com/dashboard");')
      },
      [{ kind: 'goto', pageUrl: 'https://example.com', url: 'https://example.com/dashboard' }],
    )
  })

  test('edits and persists ThousandEyes annotations', async () => {
    const temporaryDirectory = await temporaryDirectories.create()

    await runEditor(
      temporaryDirectory,
      async page => {
        const actionContentX = (await page.locator('.action-summary').first().boundingBox())?.x

        await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/messages')), page.getByRole('button', { name: 'Take screenshot after step 1' }).click()])
        await page.getByRole('button', { name: 'Start marker at step 1' }).click()
        await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/messages')), page.getByRole('button', { name: 'End marker at step 2' }).click()])
        expect(await page.getByRole('button', { name: 'Remove screenshot after step 2' }).getAttribute('aria-pressed')).toBe('true')
        expect((await page.locator('.action-summary').first().boundingBox())?.x).toBe(actionContentX)

        await page.getByRole('button', { name: 'Marker 1, steps 1–2', exact: true }).click()
        const markerEditor = page.getByRole('form', { name: 'Edit Marker 1' })
        await markerEditor.getByLabel('Marker name').fill('Load dashboard')
        await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/messages')), markerEditor.getByRole('button', { name: 'Save' }).click()])

        await page.getByRole('button', { name: 'Start marker at step 2' }).click()
        await Promise.all([page.waitForResponse(response => response.url().endsWith('/api/messages')), page.getByRole('button', { name: 'End marker at step 2' }).click()])
        expect((await page.locator('.action-summary').first().boundingBox())?.x).toBe(actionContentX)

        await page.getByRole('tab', { name: 'ThousandEyes JS' }).click()
        expect(await page.locator('.script-source').textContent()).toContain(`  markers.start("Load dashboard");
  await driver.get("https://example.com/dashboard");
  markers.start("Marker 2");
  await driver.navigate().refresh();
  markers.stop("Load dashboard");
  markers.stop("Marker 2");
  await driver.takeScreenshot();`)
      },
      [
        { kind: 'goto', pageUrl: 'https://example.com', url: 'https://example.com/dashboard' },
        { kind: 'reload', pageUrl: 'https://example.com/dashboard' },
      ],
    )

    expect(JSON.parse(await readFile(join(temporaryDirectory, 'example.recording', 'recording.json'), 'utf8')).thousandEyes).toStrictEqual({
      markers: [
        { end: 2, name: 'Load dashboard', start: 0 },
        { end: 2, name: 'Marker 2', start: 1 },
      ],
      screenshots: [{ at: 1 }],
    })
  })

  test('shows ThousandEyes generation errors', async () => {
    await runEditor(await temporaryDirectories.create(), async page => {
      await page.getByRole('tab', { name: 'ThousandEyes JS' }).click()
      expect(await page.getByText('Could not generate ThousandEyes JS').textContent()).toBeTruthy()
      expect(await page.locator('.empty-detail').textContent()).toContain('ARIA locators are not supported')
    })
  })

  test('prints the editor URL', async () => {
    expect((await runEditor(await temporaryDirectories.create(), async () => undefined)).output.join('')).toContain('Recording editor opened at http://127.0.0.1:')
  })
})

async function runEditor(temporaryDirectory: string, inspect: (page: Page, url: string) => Promise<void>, actions?: Recording['actions']): Promise<EditorResult> {
  const directoryPath = join(temporaryDirectory, 'example.recording')
  const recording: Recording = {
    ...createRecording({ startUrl: 'https://example.com', title: 'Example recording' }),
    actions: actions ?? [
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
  await writeFile(join(directoryPath, 'snapshots', '0000.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z3e8AAAAASUVORK5CYII=', 'base64'))
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
