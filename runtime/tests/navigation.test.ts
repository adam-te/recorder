import { describe, expect, test } from 'vitest'

import { createRecordingSession } from '@te/recorder-core'
import { appendCapturedInteraction, installRecordingCapture } from '@te/recorder-runtime/capture'

import { useBrowserTestHarness } from './support/browserHarness.ts'
import { getOnlyAction } from './support/recordingAssertions.ts'

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

    const click = getOnlyAction(recordingSession.snapshot(), 'click')

    expect(click.locatorCandidates[0]).toStrictEqual({ kind: 'aria', steps: [{ method: 'role', name: 'Continue', role: 'link' }] })
    expect(click.locatorCandidates).toContainEqual({ kind: 'css', value: '#target' })
  })

  test('records a click through cross-origin redirects without recording the redirects as navigation', async () => {
    const document = await browser.record({
      documents: {
        'https://destination.test/after': '<p>After</p>',
        'https://recorder.test/content': '<a id="target" href="https://redirect.test/first">Continue</a>',
      },
      interact: page => page.locator('#target').click(),
      redirects: {
        'https://redirect.test/first': 'https://redirect.test/second',
        'https://redirect.test/second': 'https://destination.test/after',
      },
    })

    expect(document.actions).toMatchObject([
      { kind: 'goto', pageUrl: 'about:blank', url: 'https://recorder.test/content' },
      { kind: 'click', pageUrl: 'https://recorder.test/content' },
    ])
  })

  test('uses the requested start URL when it redirects', async () => {
    const documents = {
      'https://recorder.test/after': `<button id="target" onclick="document.body.dataset.clicked = 'true'">Continue</button>`,
      'https://recorder.test/start': `<script>location.replace('https://recorder.test/after')</script>`,
    }
    const { document, playbackPage } = await browser.recordAndPlay({ documents, interact: page => page.locator('#target').click(), startUrl: 'https://recorder.test/start' })

    expect(document).toMatchObject({
      actions: [
        { kind: 'goto', pageUrl: 'about:blank', url: 'https://recorder.test/start' },
        { kind: 'click', pageUrl: 'https://recorder.test/after' },
      ],
      startUrl: 'https://recorder.test/start',
    })

    expect(await playbackPage.locator('body').getAttribute('data-clicked')).toBe('true')
  })

  test('records subsequent browser address entry and ignores Back, Forward, and Reload', async () => {
    const documents = { 'https://recorder.test/after': '<p>After</p>', 'https://recorder.test/content': '<p>Before</p>' }
    const { document, playbackPage } = await browser.recordAndPlay({
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

    expect(playbackPage.url()).toBe('https://recorder.test/after')
  })
})
