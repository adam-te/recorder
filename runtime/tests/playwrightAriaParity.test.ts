import { recordingRuntimeSource } from '#runtime/recording/generated/recordingRuntimeSource.generated.ts'
import { DISPOSE_OVERLAY_FUNCTION_NAME } from '#runtime/recording/protocol.ts'
import { type AriaSnapshot, renderAriaSnapshot } from '@te/aria'
import type { AriaRuntime } from '@te/aria/browser'
import { describe, expect, test } from 'vitest'

import { useBrowserTestHarness } from './support/browserHarness.ts'

describe('Playwright ARIA snapshot parity', () => {
  const browser = useBrowserTestHarness()

  test('matches Playwright AI mode', async () => {
    const { actual, expected } = await generateSnapshots(browser)

    expect(normalizeRefs(renderAriaSnapshot(actual))).toBe(normalizeRefs(expected))
  })

  test('marks the requested target in the snapshot', async () => {
    const { actual, targetRef } = await generateSnapshots(browser)

    expect({ role: actual.role, target: findNodeByRef(actual, targetRef) }).toMatchObject({ role: 'fragment', target: { cursor: 'pointer', ref: targetRef } })
  })

  test('returns snapshots in the compact recorded shape', async () => {
    expect(allNodesHaveCompactShape((await generateSnapshots(browser)).actual)).toBe(true)
  })
})

async function generateSnapshots(browser: ReturnType<typeof useBrowserTestHarness>): Promise<GeneratedSnapshots> {
  const page = await browser.page({
    html: `
        <main aria-label="Account settings">
          <h2>Profile</h2>
          <input aria-label="Email" placeholder="name@example.com" value="ada@example.com">
          <button id="target" aria-label="Save" style="cursor: pointer"><span>Visible button text</span></button>
          <ul><li>One</li><li><a href="/two">Two</a></li></ul>
          <svg aria-label="Chart"></svg>
          <p hidden>Secret content</p>
        </main>
      `,
  })

  await page.goto('https://recorder.test/content')
  await page.addScriptTag({ content: recordingRuntimeSource })
  await page.evaluate(name => (globalThis as unknown as Record<string, (() => Promise<void> | void) | undefined>)[name]?.(), DISPOSE_OVERLAY_FUNCTION_NAME)
  const generated = await page.evaluate(() => {
    const runtime = (globalThis as unknown as { ariaRuntime: AriaRuntime }).ariaRuntime

    return runtime.generateAriaSnapshot({ target: document.querySelector('#target')! })
  })
  return { actual: generated.snapshot, expected: await page.ariaSnapshot({ mode: 'ai' }), targetRef: generated.targetRef }
}

function normalizeRefs(snapshot: string): string {
  return snapshot.replace(/ref=e\d+/g, 'ref=eN')
}

function allNodesHaveCompactShape(node: AriaSnapshot): boolean {
  const forbiddenProperties = ['ariaVisible', 'box', 'playwrightVersion', 'receivesPointerEvents', 'root', 'schemaVersion', 'targetRef']
  const states = [node.active, node.checked, node.disabled, node.expanded, node.pressed, node.selected]

  return forbiddenProperties.every(property => !(property in node)) && !states.includes(false) && (node.children ?? []).every(child => typeof child === 'string' || allNodesHaveCompactShape(child))
}

function findNodeByRef(node: AriaSnapshot, ref: string | undefined): AriaSnapshot | undefined {
  if (node.ref === ref) {
    return node
  }

  return (node.children ?? []).flatMap(child => (typeof child === 'string' ? [] : [findNodeByRef(child, ref)])).find(child => child)
}

interface GeneratedSnapshots {
  actual: AriaSnapshot
  expected: string
  targetRef: string | undefined
}
