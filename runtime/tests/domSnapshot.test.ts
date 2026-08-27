import { captureDomSnapshot, type CapturedDomSnapshot } from '#runtime/snapshots/captureDomSnapshot.ts'
import { describe, expect, test } from 'vitest'

import { useBrowserTestHarness } from './support/browserHarness.ts'

describe('captureDomSnapshot', () => {
  const browser = useBrowserTestHarness()

  test('captures current DOM content', async () => {
    const { capture } = await captureFixture(browser)
    const dynamicTarget = findElement(capture, 'id', 'dynamic-target')

    expect({ dynamicTarget, text: getDirectText(capture, dynamicTarget) }).toMatchObject({
      dynamicTarget: { attributes: { 'data-state': 'updated' }, documentUrl: 'https://recorder.test/content' },
      text: 'After',
    })
  })

  test('captures content inside frames', async () => {
    expect(findElement((await captureFixture(browser)).capture, 'id', 'frame-target')).toMatchObject({ documentUrl: 'https://frame.test/content' })
  })

  test('captures content inside open shadow roots', async () => {
    const { capture } = await captureFixture(browser)

    expect({ rootTypes: getShadowRootTypes(capture), target: findElement(capture, 'id', 'shadow-target') }).toMatchObject({
      rootTypes: expect.arrayContaining(['open']),
      target: { parentIndex: expect.toSatisfy((value: number) => value >= 0) },
    })
  })

  test('does not change page markup', async () => {
    const { markupBeforeCapture, page } = await captureFixture(browser)

    expect(await page.locator('html').evaluate(element => element.outerHTML)).toBe(markupBeforeCapture)
  })
})

async function captureFixture(browser: ReturnType<typeof useBrowserTestHarness>): Promise<DomCaptureFixture> {
  const page = await browser.page({
    documents: { 'https://frame.test/content': '<button id="frame-target">Frame target</button>' },
    html: '<main id="dynamic-target" data-state="initial">Before</main><div id="shadow-host"></div><iframe src="https://frame.test/content"></iframe>',
  })

  await page.goto('https://recorder.test/content')
  await page.locator('#dynamic-target').evaluate(element => {
    element.setAttribute('data-state', 'updated')
    element.textContent = 'After'
  })
  await page.locator('#shadow-host').evaluate(element => {
    element.attachShadow({ mode: 'open' }).innerHTML = '<button id="shadow-target">Shadow target</button>'
  })
  const markupBeforeCapture = await page.locator('html').evaluate(element => element.outerHTML)

  return { capture: await captureDomSnapshot(page), markupBeforeCapture, page }
}

function findElement(capture: CapturedDomSnapshot, attributeName: string, attributeValue: string): SnapshotElement | undefined {
  for (const [documentIndex, document] of capture.snapshot.documents.entries()) {
    for (const [nodeIndex, encodedAttributes] of (document.nodes.attributes ?? []).entries()) {
      const attributes = decodeAttributes(capture.snapshot.strings, encodedAttributes)

      if (attributes[attributeName] === attributeValue) {
        return {
          attributes,
          documentIndex,
          documentUrl: capture.snapshot.strings[document.documentURL] ?? '',
          nodeIndex,
          parentIndex: document.nodes.parentIndex?.[nodeIndex],
        }
      }
    }
  }

  return undefined
}

function decodeAttributes(strings: string[], encodedAttributes: number[]): Record<string, string> {
  const attributes: Record<string, string> = {}

  for (let index = 0; index < encodedAttributes.length; index += 2) {
    const name = strings[encodedAttributes[index]!]

    if (name) {
      attributes[name] = strings[encodedAttributes[index + 1]!] ?? ''
    }
  }

  return attributes
}

function getDirectText(capture: CapturedDomSnapshot, element: SnapshotElement | undefined): string | undefined {
  if (!element) {
    return undefined
  }

  const document = capture.snapshot.documents[element.documentIndex]!
  const childIndex = document.nodes.parentIndex?.findIndex(parentIndex => parentIndex === element.nodeIndex)

  return childIndex === undefined || childIndex < 0 ? undefined : capture.snapshot.strings[document.nodes.nodeValue?.[childIndex] ?? -1]
}

function getShadowRootTypes(capture: CapturedDomSnapshot): string[] {
  return capture.snapshot.documents.flatMap(document => (document.nodes.shadowRootType?.value ?? []).map(value => capture.snapshot.strings[value] ?? ''))
}

interface SnapshotElement {
  attributes: Record<string, string>
  documentIndex: number
  documentUrl: string
  nodeIndex: number
  parentIndex?: number
}

interface DomCaptureFixture {
  capture: CapturedDomSnapshot
  markupBeforeCapture: string
  page: Awaited<ReturnType<ReturnType<typeof useBrowserTestHarness>['page']>>
}
