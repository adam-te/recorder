import { describe, expect, test } from 'vitest'

import { useBrowserTestHarness } from './support/browserHarness.ts'
import { getOnlyAction } from './support/recordingAssertions.ts'

describe('navigation recording', () => {
  const browser = useBrowserTestHarness()

  test('records click-triggered navigation without inspecting the departing document', async () => {
    const documents = { 'https://recorder.test/after': '<p>After</p>', 'https://recorder.test/content': '<a id="target" href="/after">Continue</a>' }
    const click = getOnlyAction(await browser.record({ documents, interact: page => page.locator('#target').click() }), 'click')

    expect(click.locatorCandidates[0]).toStrictEqual({ kind: 'aria', steps: [{ method: 'role', name: 'Continue', role: 'link' }] })
    expect(click.locatorCandidates).toContainEqual({ kind: 'css', value: '#target' })
  })

  test('records a click through cross-origin redirects without recording the redirects as navigation', async () => {
    const recording = await browser.record({
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

    expect(recording.actions).toMatchObject([
      { kind: 'goto', pageUrl: 'about:blank', url: 'https://recorder.test/content' },
      { kind: 'click', pageUrl: 'https://recorder.test/content' },
    ])
  })

  test('uses the requested start URL when it redirects', async () => {
    const recording = await browser.record({ documents: redirectingStartDocuments, interact: page => page.locator('#target').click(), startUrl: 'https://recorder.test/start' })

    expect(recording).toMatchObject({
      actions: [
        { kind: 'goto', pageUrl: 'about:blank', url: 'https://recorder.test/start' },
        { kind: 'click', pageUrl: 'https://recorder.test/after' },
      ],
      startUrl: 'https://recorder.test/start',
    })
  })

  test('plays back recordings whose requested start URL redirects', async () => {
    const { playbackPage } = await browser.recordAndPlay({ documents: redirectingStartDocuments, interact: page => page.locator('#target').click(), startUrl: 'https://recorder.test/start' })

    expect(await playbackPage.locator('body').getAttribute('data-clicked')).toBe('true')
  })

  test('records subsequent browser address entry', async () => {
    expect(
      (
        await browser.record({
          documents: navigationDocuments,
          interact: page => page.goto('https://recorder.test/after'),
        })
      ).actions,
    ).toStrictEqual([
      { kind: 'goto', pageUrl: 'about:blank', url: 'https://recorder.test/content' },
      { kind: 'goto', pageUrl: 'https://recorder.test/content', url: 'https://recorder.test/after' },
    ])
  })

  test('ignores Back, Forward, and Reload', async () => {
    const recording = await browser.record({
      documents: navigationDocuments,
      interact: async page => {
        await page.goto('https://recorder.test/after')
        await page.goBack()
        await page.goForward()
        await page.reload()
      },
    })

    expect(recording.actions).toStrictEqual([
      { kind: 'goto', pageUrl: 'about:blank', url: 'https://recorder.test/content' },
      { kind: 'goto', pageUrl: 'https://recorder.test/content', url: 'https://recorder.test/after' },
    ])
  })

  test('plays back subsequent browser address entry', async () => {
    const { playbackPage } = await browser.recordAndPlay({
      documents: navigationDocuments,
      interact: page => page.goto('https://recorder.test/after'),
    })

    expect(playbackPage.url()).toBe('https://recorder.test/after')
  })
})

const navigationDocuments = { 'https://recorder.test/after': '<p>After</p>', 'https://recorder.test/content': '<p>Before</p>' }
const redirectingStartDocuments = {
  'https://recorder.test/after': `<button id="target" onclick="document.body.dataset.clicked = 'true'">Continue</button>`,
  'https://recorder.test/start': `<script>location.replace('https://recorder.test/after')</script>`,
}
