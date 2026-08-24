import { describe, expect, test } from 'vitest'

import { createRecordingSession } from '@te/recorder-core'
import { appendCapturedInteraction, installRecordingCapture } from '@te/recorder-runtime/capture'

import { useBrowserTestHarness } from './utils.ts'

describe('navigation recording', () => {
  const browser = useBrowserTestHarness()

  test('records click-triggered navigation without inspecting the departing document', async () => {
    const documents = { 'https://recorder.test/after': '<p>After</p>', 'https://recorder.test/content': '<a id="target" href="/after">Continue</a>' }
    const recordingSession = createRecordingSession({ startUrl: 'https://recorder.test/content', title: 'Smoke test' })
    const recorded = Promise.withResolvers<void>()
    const page = await browser.page({ documents })

    await installRecordingCapture({
      context: browser.context,
      onInteraction: interaction => {
        const recording = appendCapturedInteraction({ interaction, recordingSession })
        recording.then(() => recorded.resolve(), recorded.reject)
      },
      page,
      recordingSession,
      startUrl: 'https://recorder.test/content',
    })
    await page.locator('#target').click()
    await recorded.promise

    const action = recordingSession.snapshot().actions.find(currentAction => currentAction.kind === 'click')

    expect(action?.kind).toBe('click')
    expect(action?.kind === 'click' ? action.locatorCandidates[0] : undefined).toStrictEqual({ kind: 'aria', steps: [{ method: 'role', name: 'Continue', role: 'link' }] })
    expect(action && 'locatorCandidates' in action ? action.locatorCandidates : []).toContainEqual({ kind: 'css', value: '#target' })
  })

  test('uses the requested start URL when it redirects', async () => {
    const documents = {
      'https://recorder.test/after': `<button id="target" onclick="document.body.dataset.clicked = 'true'">Continue</button>`,
      'https://recorder.test/start': `<script>location.replace('https://recorder.test/after')</script>`,
    }
    const document = await browser.record({ documents, interact: page => page.locator('#target').click(), startUrl: 'https://recorder.test/start' })

    expect(document).toMatchObject({
      actions: [
        { kind: 'goto', pageUrl: 'about:blank', url: 'https://recorder.test/start' },
        { kind: 'click', pageUrl: 'https://recorder.test/after' },
      ],
      startUrl: 'https://recorder.test/start',
    })

    const playbackPage = await browser.play({ document, documents })

    expect(await playbackPage.locator('body').getAttribute('data-clicked')).toBe('true')
  })

  test('records subsequent browser address entry and ignores Back, Forward, and Reload', async () => {
    const documents = { 'https://recorder.test/after': '<p>After</p>', 'https://recorder.test/content': '<p>Before</p>' }
    const document = await browser.record({
      documents,
      interact: async page => {
        await page.goto('https://recorder.test/after')
        await page.goBack()
        await page.goForward()
        await page.reload()
      },
    })

    expect(document.actions).toStrictEqual([
      { kind: 'goto', pageUrl: 'about:blank', url: 'https://recorder.test/content' },
      { kind: 'goto', pageUrl: 'https://recorder.test/content', url: 'https://recorder.test/after' },
    ])
    expect(document.startUrl).toBe('https://recorder.test/content')

    const playbackPage = await browser.play({ document, documents })

    expect(playbackPage.url()).toBe('https://recorder.test/after')
  })
})
