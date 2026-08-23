import type { AriaRuntime } from '@te/aria'
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

    expect(normalizeRefs(actual.snapshot)).toBe(normalizeRefs(expected))
    expect(actual.targetRef).toMatch(/^e\d+$/)
    expect(actual.snapshot).toContain(`[ref=${actual.targetRef}]`)
  })
})

function normalizeRefs(snapshot: string): string {
  return snapshot.replace(/ref=e\d+/g, 'ref=eN')
}
