import { createRecordingCapture, type RecordingCapture } from '#runtime/recording/capture/createRecordingCapture.ts'
import type { CapturedInteractionEvent } from '#runtime/recording/capture/types.ts'
import { describe, expect, test } from 'vitest'

import { useBrowserTestHarness } from './support/browserHarness.ts'

describe('interaction capture', () => {
  const browser = useBrowserTestHarness()

  test('captures interactions inside shadow DOM', async () => {
    const html = `<div id="host"></div><script>document.querySelector('#host').attachShadow({ mode: 'open' }).innerHTML = '<button id="target">Click</button>'</script>`
    await browser.capture({ expectedKind: 'click', html, interact: page => page.locator('#host').locator('#target').click() })
  })

  test('captures interactions inside cross-origin frames', async () => {
    const interaction = await browser.capture({
      documents: { 'https://frame.test/content': '<button id="target">Click</button>' },
      expectedKind: 'click',
      html: '<iframe src="https://frame.test/content"></iframe>',
      interact: page => page.frameLocator('iframe').locator('#target').click(),
    })

    expect(interaction.frameHostname).toBe('frame.test')
  })

  test('captures interactions under a strict content security policy', async () => {
    await browser.capture({
      expectedKind: 'click',
      headers: { 'content-security-policy': "default-src 'none'; script-src 'none'; style-src 'none'; require-trusted-types-for 'script'; trusted-types 'none'" },
      html: '<button id="target">Click</button>',
      interact: page => page.locator('#target').click(),
    })
  })

  test('updates the locator tooltip for the highlighted element', async () => {
    const page = await browser.page({ html: '<button id="target">Click</button>' })
    const capture = await createRecordingCapture({ context: browser.context, page, startUrl: 'https://recorder.test/content' })

    await capture.start()

    await page.locator('#target').hover()
    const cdpSession = await browser.context.newCDPSession(page)
    const overlaySnapshot = await cdpSession.send('DOMSnapshot.captureSnapshot', { computedStyles: [], includeDOMRects: false, includePaintOrder: false })

    expect(overlaySnapshot.strings).toContain('getByRole("button", { name: "Click" })')
    await page.locator('body').dispatchEvent('mousemove')
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
    const fallbackSnapshot = await cdpSession.send('DOMSnapshot.captureSnapshot', { computedStyles: [], includeDOMRects: false, includePaintOrder: false })

    expect(fallbackSnapshot.strings).toContain('locator("body")')
    await cdpSession.detach()
    await capture.dispose()
  })

  test('does not change page markup or click targeting while highlighting', async () => {
    const page = await browser.page({ html: '<button id="target">Click</button><script>window.clicks = 0; document.querySelector("#target").addEventListener("click", () => window.clicks += 1)</script>' })
    const capture = await createRecordingCapture({ context: browser.context, page, startUrl: 'https://recorder.test/content' })

    await capture.start()
    const initialMarkup = await page.locator('html').evaluate(element => element.outerHTML)

    await page.locator('#target').hover()
    await page.locator('#target').click()

    expect({ clicks: await page.evaluate(() => (window as unknown as { clicks: number }).clicks), markup: await page.locator('html').evaluate(element => element.outerHTML) }).toStrictEqual({
      clicks: 1,
      markup: initialMarkup,
    })
    await capture.dispose()
  })

  test('highlights nested-frame elements in their document', async () => {
    const overlaySnapshot = await captureNestedFrameOverlay(browser)

    expect(findDocumentsContainingText(overlaySnapshot, 'getByRole("button", { name: "Frame action" })')).toHaveLength(1)
  })

  test('shows recording controls only in the top frame', async () => {
    const overlaySnapshot = await captureNestedFrameOverlay(browser)
    const stopDocuments = findDocumentsContainingText(overlaySnapshot, 'Stop recording')
    const frameTooltipDocuments = findDocumentsContainingText(overlaySnapshot, 'getByRole("button", { name: "Frame action" })')

    expect({ controls: stopDocuments.length, shareDocument: frameTooltipDocuments[0] === stopDocuments[0], tooltips: frameTooltipDocuments.length }).toStrictEqual({
      controls: 1,
      shareDocument: false,
      tooltips: 1,
    })
  })

  test('stops from the recording panel without capturing its click', async () => {
    const page = await browser.page({ html: '<button>Page button</button>' })
    const captureReady = Promise.withResolvers<RecordingCapture>()
    const stopped = Promise.withResolvers<void>()
    const interactions: CapturedInteractionEvent[] = []
    const capture = await createRecordingCapture({
      context: browser.context,
      onInteraction: interaction => {
        interactions.push(interaction.event)
      },
      onStopRequested: async () => {
        await (await captureReady.promise).dispose()
        stopped.resolve()
      },
      page,
      startUrl: 'https://recorder.test/content',
    })
    captureReady.resolve(capture)
    await capture.start()
    const panel = await page.locator('[data-thousandeyes-recorder-ui]').boundingBox()

    if (!panel) {
      throw new Error('Expected recording controls to be visible.')
    }

    await page.mouse.click(panel.x + panel.width - 45, panel.y + panel.height / 2)
    await stopped.promise

    expect(interactions).toStrictEqual([])
  })
})

async function captureNestedFrameOverlay(browser: ReturnType<typeof useBrowserTestHarness>): Promise<DomSnapshot> {
  const documents = { 'https://frame.test/content': '<button id="target">Frame action</button>' }
  const page = await browser.page({ documents, html: '<iframe src="https://frame.test/content"></iframe>' })
  const capture = await createRecordingCapture({ context: browser.context, onStopRequested: () => undefined, page, startUrl: 'https://recorder.test/content' })

  await capture.start()
  await page.frameLocator('iframe').locator('#target').hover()
  const cdpSession = await browser.context.newCDPSession(page)
  const overlaySnapshot = await cdpSession.send('DOMSnapshot.captureSnapshot', { computedStyles: [], includeDOMRects: false, includePaintOrder: false })
  await cdpSession.detach()
  await capture.dispose()

  return overlaySnapshot
}

function findDocumentsContainingText(snapshot: DomSnapshot, text: string): number[] {
  const stringIndex = snapshot.strings.indexOf(text)

  return stringIndex === -1 ? [] : snapshot.documents.flatMap((document, documentIndex) => (document.nodes.nodeValue?.includes(stringIndex) ? [documentIndex] : []))
}

interface DomSnapshot {
  documents: { nodes: { nodeValue?: number[] } }[]
  strings: string[]
}
