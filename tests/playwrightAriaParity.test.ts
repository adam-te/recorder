import { type AriaRuntime, type AriaSnapshot, renderAriaSnapshot } from '@te/aria'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { ariaRuntimeSource } from '../runtime/recording/injected/ariaRuntimeSource.generated.ts'
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
          <button id="target" aria-label="Save" style="cursor: pointer"><span>Visible button text</span></button>
          <ul><li>One</li><li><a href="/two">Two</a></li></ul>
          <svg aria-label="Chart"></svg>
          <p hidden>Secret content</p>
        </main>
      `,
    })

    await page.goto('https://recorder.test/content')
    await page.addScriptTag({ content: `${ariaRuntimeSource};globalThis.__testAriaRuntime=ariaRuntime` })
    const generated = await page.evaluate(() => {
      const runtime = (globalThis as unknown as { __testAriaRuntime: AriaRuntime }).__testAriaRuntime

      return runtime.generateAriaSnapshot({ target: document.querySelector('#target')! })
    })
    const actual = generated.snapshot
    const expected = await page.ariaSnapshot({ mode: 'ai' })
    const rendered = renderAriaSnapshot(actual)
    const deserialized = JSON.parse(JSON.stringify(actual)) as AriaSnapshot

    expect(normalizeRefs(rendered)).toBe(normalizeRefs(expected))
    expect(renderAriaSnapshot(deserialized)).toBe(rendered)
    expect(deserialized).toStrictEqual(actual)
    expect(actual).toMatchObject({ role: 'fragment' })
    expect(actual).not.toHaveProperty('playwrightVersion')
    expect(actual).not.toHaveProperty('root')
    expect(actual).not.toHaveProperty('schemaVersion')
    expect(actual).not.toHaveProperty('targetRef')
    expect(generated.targetRef).toMatch(/^e\d+$/)
    expect(rendered).toContain(`[ref=${generated.targetRef}]`)
    expect(rendered).toContain(`[cursor=pointer]`)
    expect(findNodeByRef(actual, generated.targetRef)?.cursor).toBe('pointer')
    expect(allNodesHaveCompactShape(actual)).toBe(true)
  })
})

function normalizeRefs(snapshot: string): string {
  return snapshot.replace(/ref=e\d+/g, 'ref=eN')
}

function allNodesHaveCompactShape(node: AriaSnapshot): boolean {
  const states = [node.active, node.checked, node.disabled, node.expanded, node.pressed, node.selected]

  return !('ariaVisible' in node) && !('box' in node) && !('receivesPointerEvents' in node) && !states.includes(false) && (node.children ?? []).every(child => typeof child === 'string' || allNodesHaveCompactShape(child))
}

function findNodeByRef(node: AriaSnapshot, ref: string | undefined): AriaSnapshot | undefined {
  if (node.ref === ref) {
    return node
  }

  return (node.children ?? []).flatMap(child => (typeof child === 'string' ? [] : [findNodeByRef(child, ref)])).find(child => child !== undefined)
}
