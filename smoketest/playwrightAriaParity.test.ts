import { type AriaRuntime, type AriaSnapshot, renderAriaSnapshot } from '@te/aria'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { ariaRuntimeSource } from '../runtime/recording/injected/ariaRuntimeSource.ts'
import { createPage, useBrowserTestFixture } from './utils.ts'

describe('Playwright ARIA snapshot parity', () => {
  const fixture = useBrowserTestFixture({ afterAll, afterEach, beforeAll, beforeEach })

  test('matches Playwright AI mode', async () => {
    const page = await createPage({
      context: fixture.context,
      html: `
        <main aria-label="Account settings">
          <h2>Profile</h2>
          <input aria-label="Email" placeholder="name@example.com" value="ada@example.com">
          <button id="target" aria-label="Save"><span>Visible button text</span></button>
          <ul><li>One</li><li><a href="/two">Two</a></li></ul>
          <svg aria-label="Chart"></svg>
          <p hidden>Secret content</p>
        </main>
      `,
    })

    await page.goto('https://recorder.test/content')
    await page.addScriptTag({ content: `${ariaRuntimeSource};globalThis.__testAriaRuntime=ariaRuntime` })
    const actual = await page.evaluate(() => {
      const runtime = (globalThis as unknown as { __testAriaRuntime: AriaRuntime }).__testAriaRuntime

      return runtime.generateAriaSnapshot({ target: document.querySelector('#target')! })
    })
    const expected = await page.ariaSnapshot({ mode: 'ai' })
    const rendered = renderAriaSnapshot(actual)
    const deserialized = JSON.parse(JSON.stringify(actual)) as AriaSnapshot

    expect(normalizeRefs(rendered)).toBe(normalizeRefs(expected))
    expect(renderAriaSnapshot(deserialized)).toBe(rendered)
    expect(deserialized).toStrictEqual(actual)
    expect(actual.schemaVersion).toBe(1)
    expect(actual.playwrightVersion).toBe('1.59.1')
    expect(actual.targetRef).toMatch(/^e\d+$/)
    expect(rendered).toContain(`[ref=${actual.targetRef}]`)
    expect(allNodesHaveAriaVisibility(actual.root)).toBe(true)
  })
})

function normalizeRefs(snapshot: string): string {
  return snapshot.replace(/ref=e\d+/g, 'ref=eN')
}

function allNodesHaveAriaVisibility(node: AriaSnapshot['root']): boolean {
  return typeof node.ariaVisible === 'boolean' && node.children.every(child => typeof child === 'string' || allNodesHaveAriaVisibility(child))
}
