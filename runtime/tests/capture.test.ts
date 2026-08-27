import { describe, expect, test } from 'vitest'

import { createRecordingSession } from '@te/recorder-core'
import { installRecordingCapture, type CapturedInteractionEvent, type RecordingCapture } from '@te/recorder-runtime/capture'

import { useBrowserTestHarness } from './support/browserHarness.ts'

describe('interaction capture', () => {
  const browser = useBrowserTestHarness()

  test('captures interactions inside shadow DOM', async () => {
    const html = `<div id="host"></div><script>document.querySelector('#host').attachShadow({ mode: 'open' }).innerHTML = '<button id="target">Click</button>'</script>`
    const interaction = await browser.capture({ expectedKind: 'click', html, interact: page => page.locator('#host').locator('#target').click() })

    expect(interaction).toMatchObject({ frameHostname: 'recorder.test', kind: 'click', selectors: expect.arrayContaining([expect.any(String)]) })
  })

  test('captures interactions inside cross-origin frames', async () => {
    const interaction = await browser.capture({
      documents: { 'https://frame.test/content': '<button id="target">Click</button>' },
      expectedKind: 'click',
      html: '<iframe src="https://frame.test/content"></iframe>',
      interact: page => page.frameLocator('iframe').locator('#target').click(),
    })

    expect(interaction).toMatchObject({ frameHostname: 'frame.test', kind: 'click', selectors: expect.arrayContaining([expect.any(String)]) })
  })

  test('captures interactions under a strict content security policy', async () => {
    const interaction = await browser.capture({
      expectedKind: 'click',
      headers: { 'content-security-policy': "default-src 'none'; script-src 'none'; style-src 'none'; require-trusted-types-for 'script'; trusted-types 'none'" },
      html: '<button id="target">Click</button>',
      interact: page => page.locator('#target').click(),
    })

    expect(interaction).toMatchObject({ frameHostname: 'recorder.test', kind: 'click', selectors: expect.arrayContaining([expect.any(String)]) })
  })

  test('does not change page markup or click targeting while highlighting', async () => {
    const page = await browser.page({ html: '<button id="target">Click</button><script>window.clicks = 0; document.querySelector("#target").addEventListener("click", () => window.clicks += 1)</script>' })
    const recordingSession = createRecordingSession({ startUrl: 'https://recorder.test/content', title: 'Smoke test' })
    const capture = await installRecordingCapture({ context: browser.context, onInteraction: () => undefined, page, recordingSession, startUrl: 'https://recorder.test/content' })
    const initialMarkup = await page.locator('html').evaluate(element => element.outerHTML)

    await page.locator('#target').hover()
    const cdpSession = await browser.context.newCDPSession(page)
    const overlaySnapshot = await cdpSession.send('DOMSnapshot.captureSnapshot', { computedStyles: [], includeDOMRects: false, includePaintOrder: false })

    expect(overlaySnapshot.strings).toContain('getByRole("button", { name: "Click" })')
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

  test('highlights nested-frame elements but shows controls only in the top frame', async () => {
    const documents = { 'https://frame.test/content': '<button id="target">Frame action</button>' }
    const page = await browser.page({ documents, html: '<iframe src="https://frame.test/content"></iframe>' })
    const recordingSession = createRecordingSession({ startUrl: 'https://recorder.test/content', title: 'Smoke test' })
    const capture = await installRecordingCapture({ context: browser.context, onInteraction: () => undefined, onStopRequested: () => undefined, page, recordingSession, startUrl: 'https://recorder.test/content' })

    await page.frameLocator('iframe').locator('#target').hover()
    const cdpSession = await browser.context.newCDPSession(page)
    const overlaySnapshot = await cdpSession.send('DOMSnapshot.captureSnapshot', { computedStyles: [], includeDOMRects: false, includePaintOrder: false })
    const stopDocuments = findDocumentsContainingText(overlaySnapshot, 'Stop recording')
    const frameTooltipDocuments = findDocumentsContainingText(overlaySnapshot, 'getByRole("button", { name: "Frame action" })')

    expect(stopDocuments).toHaveLength(1)
    expect(frameTooltipDocuments).toHaveLength(1)
    expect(frameTooltipDocuments[0]).not.toBe(stopDocuments[0])
    await cdpSession.detach()
    await capture.dispose()
  })

  test('stops from the recording panel without capturing its click', async () => {
    const page = await browser.page({ html: '<button>Page button</button>' })
    const recordingSession = createRecordingSession({ startUrl: 'https://recorder.test/content', title: 'Smoke test' })
    const captureReady = Promise.withResolvers<RecordingCapture>()
    const stopped = Promise.withResolvers<void>()
    const interactions: CapturedInteractionEvent[] = []
    const capture = await installRecordingCapture({
      context: browser.context,
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

function findDocumentsContainingText(snapshot: DomSnapshot, text: string): number[] {
  const stringIndex = snapshot.strings.indexOf(text)

  return stringIndex === -1 ? [] : snapshot.documents.flatMap((document, documentIndex) => (document.nodes.nodeValue?.includes(stringIndex) ? [documentIndex] : []))
}

interface DomSnapshot {
  documents: { nodes: { nodeValue?: number[] } }[]
  strings: string[]
}
