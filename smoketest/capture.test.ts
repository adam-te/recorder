import type { Page } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { createRecordingSession } from '@te/recorder-core'
import { installRecordingCapture, type CapturedInteractionEvent, type RecordingCapture } from '@te/recorder-runtime/capture'

import { captureInteraction, createPage, useBrowserTestFixture } from './utils.ts'

describe('interaction capture', () => {
  const fixture = useBrowserTestFixture({ afterAll, afterEach, beforeAll, beforeEach })

  const eventCases: EventCase[] = [
    { expectedKind: 'click', html: '<button id="target">Click</button>', interact: page => page.locator('#target').click(), name: 'captures clicks' },
    { expectedKind: 'input', html: '<input id="target">', interact: page => page.locator('#target').fill('Ada'), name: 'captures input' },
    { expectedKind: 'change', html: '<select id="target"><option>A</option><option>B</option></select>', interact: page => page.locator('#target').selectOption('B'), name: 'captures changes' },
    { expectedKind: 'keydown', html: '<input id="target">', interact: page => page.locator('#target').press('Enter'), name: 'captures key presses' },
  ]

  eventCases.forEach(testCase =>
    test(testCase.name, async () => {
      const interaction = await captureInteraction({ expectedKind: testCase.expectedKind, fixture, html: testCase.html, interact: testCase.interact })

      expect(interaction).toMatchObject({ frameHostname: 'recorder.test', kind: testCase.expectedKind })
      expect(interaction.selectors.length).toBeGreaterThan(0)
    }),
  )

  test('captures interactions inside shadow DOM', async () => {
    const html = `<div id="host"></div><script>document.querySelector('#host').attachShadow({ mode: 'open' }).innerHTML = '<button id="target">Click</button>'</script>`
    const interaction = await captureInteraction({ expectedKind: 'click', fixture, html, interact: page => page.locator('#host').locator('#target').click() })

    expect(interaction).toMatchObject({ frameHostname: 'recorder.test', kind: 'click' })
    expect(interaction.selectors.length).toBeGreaterThan(0)
  })

  test('captures interactions inside cross-origin frames', async () => {
    const interaction = await captureInteraction({
      documents: { 'https://frame.test/content': '<button id="target">Click</button>' },
      expectedKind: 'click',
      fixture,
      html: '<iframe src="https://frame.test/content"></iframe>',
      interact: page => page.frameLocator('iframe').locator('#target').click(),
    })

    expect(interaction).toMatchObject({ frameHostname: 'frame.test', kind: 'click' })
    expect(interaction.selectors.length).toBeGreaterThan(0)
  })

  test('captures interactions under a strict content security policy', async () => {
    const interaction = await captureInteraction({
      expectedKind: 'click',
      fixture,
      headers: { 'content-security-policy': "default-src 'none'; script-src 'none'; style-src 'none'; require-trusted-types-for 'script'; trusted-types 'none'" },
      html: '<button id="target">Click</button>',
      interact: page => page.locator('#target').click(),
    })

    expect(interaction).toMatchObject({ frameHostname: 'recorder.test', kind: 'click' })
    expect(interaction.selectors.length).toBeGreaterThan(0)
  })

  test('does not change page markup or click targeting while highlighting', async () => {
    const page = await createPage({ context: fixture.context, html: '<button id="target">Click</button><script>window.clicks = 0; document.querySelector("#target").addEventListener("click", () => window.clicks += 1)</script>' })
    const recordingSession = createRecordingSession({ startUrl: 'https://recorder.test/content', title: 'Smoke test' })
    const capture = await installRecordingCapture({ context: fixture.context, onInteraction: () => undefined, page, recordingSession, startUrl: 'https://recorder.test/content' })
    const initialMarkup = await page.locator('html').evaluate(element => element.outerHTML)

    await page.locator('#target').hover()
    const cdpSession = await fixture.context.newCDPSession(page)
    const overlaySnapshot = await cdpSession.send('DOMSnapshot.captureSnapshot', { computedStyles: [], includeDOMRects: false, includePaintOrder: false })

    expect(overlaySnapshot.strings).toContain('getByRole("button", { name: "Click", exact: true })')
    await page.locator('body').dispatchEvent('mousemove')
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
    const fallbackSnapshot = await cdpSession.send('DOMSnapshot.captureSnapshot', { computedStyles: [], includeDOMRects: false, includePaintOrder: false })

    expect(fallbackSnapshot.strings).toContain('locator("body")')
    await cdpSession.detach()
    await page.locator('#target').click()

    expect(await page.locator('html').evaluate(element => element.outerHTML)).toBe(initialMarkup)
    expect(await page.evaluate(() => (window as unknown as { clicks: number }).clicks)).toBe(1)
    await capture.dispose()
  })

  test('stops from the recording panel without capturing its click', async () => {
    const page = await createPage({ context: fixture.context, html: '<button>Page button</button>' })
    const recordingSession = createRecordingSession({ startUrl: 'https://recorder.test/content', title: 'Smoke test' })
    const captureReady = Promise.withResolvers<RecordingCapture>()
    const stopped = Promise.withResolvers<void>()
    const interactions: CapturedInteractionEvent[] = []
    const capture = await installRecordingCapture({
      context: fixture.context,
      onInteraction: interaction => {
        interactions.push(interaction.event)
      },
      onStopRequested: async () => {
        await (await captureReady.promise).dispose()
        stopped.resolve()
      },
      page,
      recordingSession,
      startUrl: 'https://recorder.test/content',
    })
    captureReady.resolve(capture)
    const panel = await page.locator('[data-thousandeyes-recorder-ui]').boundingBox()

    if (!panel) {
      throw new Error('Expected recording controls to be visible.')
    }

    await page.mouse.click(panel.x + panel.width - 45, panel.y + panel.height / 2)
    await stopped.promise

    expect(interactions).toStrictEqual([])
  })
})

interface EventCase {
  expectedKind: CapturedInteractionEvent['kind']
  html: string
  interact: (page: Page) => Promise<unknown>
  name: string
}
