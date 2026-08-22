import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import type { CapturedDomSnapshot } from '@te/recorder-runtime/capture'
import { captureDomSnapshot } from '@te/recorder-runtime/capture'

import { createPage, useBrowserTestFixture } from './utils.ts'

describe('captureDomSnapshot', () => {
  const fixture = useBrowserTestFixture({ afterAll, afterEach, beforeAll, beforeEach })

  test('captures current DOM content across frames and open shadow roots', async () => {
    const page = await createPage({
      context: fixture.context,
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

    const capture = await captureDomSnapshot(page)

    const dynamicTarget = findElement(capture, 'id', 'dynamic-target')
    const frameTarget = findElement(capture, 'id', 'frame-target')
    const shadowTarget = findElement(capture, 'id', 'shadow-target')

    expect(capture).toMatchObject({ pageUrl: 'https://recorder.test/content', version: 1 })
    expect(Number.isNaN(Date.parse(capture.capturedAt))).toBe(false)
    expect(dynamicTarget).toMatchObject({ attributes: { 'data-state': 'updated' }, documentUrl: 'https://recorder.test/content' })
    expect(getDirectText(capture, dynamicTarget)).toBe('After')
    expect(frameTarget).toMatchObject({ documentUrl: 'https://frame.test/content' })
    expect([dynamicTarget, frameTarget, shadowTarget].every(target => Boolean(target?.backendNodeId))).toBe(true)
    expect(shadowTarget?.parentIndex).toBeGreaterThanOrEqual(0)
    expect(getShadowRootTypes(capture)).toContain('open')
    expect(await page.locator('html').evaluate(element => element.outerHTML)).toBe(markupBeforeCapture)
  })
})

function findElement(capture: CapturedDomSnapshot, attributeName: string, attributeValue: string): SnapshotElement | undefined {
  for (const [documentIndex, document] of capture.snapshot.documents.entries()) {
    for (const [nodeIndex, encodedAttributes] of (document.nodes.attributes ?? []).entries()) {
      const attributes = decodeAttributes(capture.snapshot.strings, encodedAttributes)

      if (attributes[attributeName] === attributeValue) {
        return {
          attributes,
          backendNodeId: document.nodes.backendNodeId?.[nodeIndex],
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
  backendNodeId?: number
  documentIndex: number
  documentUrl: string
  nodeIndex: number
  parentIndex?: number
}
