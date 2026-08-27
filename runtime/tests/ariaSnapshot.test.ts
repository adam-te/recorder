import { type AriaNode, renderAriaSnapshot } from '@te/aria'
import type { Page } from 'playwright'
import { describe, expect, test } from 'vitest'

import { useBrowserTestHarness } from './support/browserHarness.ts'

describe('ARIA interaction snapshots', () => {
  const browser = useBrowserTestHarness()

  test('captures current-frame semantics and the target ref before click handlers change the page', async () => {
    const html = `
      <main aria-label="Account settings">
        <h2>Profile</h2>
        <input aria-describedby="email-help" aria-invalid="grammar" aria-label="Email" readonly required value="ada@example.com">
        <span id="email-help">Used for notifications</span>
        <button id="target" aria-expanded="false" onclick="this.textContent = 'Changed'; this.setAttribute('aria-expanded', 'true')">Open settings</button>
        <button disabled>Unavailable</button>
        <button aria-hidden="true">Accessibility hidden</button>
        <p hidden>Secret content</p>
      </main>
    `
    const interaction = await browser.capture({ expectedKind: 'click', html, interact: page => page.locator('#target').click() })
    const yaml = renderAriaSnapshot(interaction.ariaSnapshot)

    expect(interaction.targetRef).toMatch(/^e\d+$/)
    expect(normalizeRefs(yaml, interaction.targetRef)).toMatchInlineSnapshot(`
      "- main "Account settings" [ref=eN]:
        - heading "Profile" [level=2] [ref=eN]
        - textbox "Email" [invalid=grammar] [ref=eN]: ada@example.com
        - text: Used for notifications
        - button "Open settings" [active] [ref=target]
        - button "Unavailable" [disabled] [ref=eN]
        - button [ref=eN]: Accessibility hidden"
    `)
    expect(findNodes(interaction.ariaSnapshot).every(node => !('ariaVisible' in node) && !('box' in node) && !('receivesPointerEvents' in node))).toBe(true)
  })

  test('captures the interaction frame without including the parent frame', async () => {
    const interaction = await browser.capture({
      documents: { 'https://frame.test/content': '<main aria-label="Frame content"><button id="target">Frame action</button></main>' },
      expectedKind: 'click',
      html: '<main aria-label="Parent content"><iframe src="https://frame.test/content"></iframe></main>',
      interact: async page => page.frameLocator('iframe').locator('#target').click(),
    })
    const yaml = renderAriaSnapshot(interaction.ariaSnapshot)

    expect(interaction.frameHostname).toBe('frame.test')
    expect(yaml).toContain('Frame content')
    expect(yaml).toContain('Frame action')
    expect(yaml).not.toContain('Parent content')
  })

  test('traverses open shadow roots without exposing closed shadow roots', async () => {
    const html = `
      <div id="open-host"></div>
      <div id="closed-host"></div>
      <script>
        document.querySelector('#open-host').attachShadow({ mode: 'open' }).innerHTML = '<button>Open shadow action</button>';
        const closedRoot = document.querySelector('#closed-host').attachShadow({ mode: 'closed' });
        const target = document.createElement('button');
        target.textContent = 'Closed shadow action';
        target.style.cssText = 'position: fixed; left: 20px; top: 20px; width: 180px; height: 40px';
        closedRoot.append(target);
      </script>
    `
    const interaction = await browser.capture({ expectedKind: 'click', html, interact: clickClosedShadowButton })
    const yaml = renderAriaSnapshot(interaction.ariaSnapshot)

    expect(yaml).toContain('- button "Open shadow action"')
    expect(yaml).not.toContain('- button "Closed shadow action"')
    expect(interaction.targetRef).toBeUndefined()
  })

  test('selects the nearest actionable ARIA ancestor of the raw event target', async () => {
    const html = '<button id="action"><span id="target">Save</span></button>'
    const interaction = await browser.capture({ expectedKind: 'click', html, interact: page => page.locator('#target').click() })
    const target = findNodes(interaction.ariaSnapshot).find(node => node.ref === interaction.targetRef)

    expect(target).toMatchObject({ name: 'Save', role: 'button' })
    expect(target).not.toHaveProperty('children')
  })
})

async function clickClosedShadowButton(page: Page): Promise<void> {
  await page.mouse.click(40, 40)
}

function findNodes(root: AriaNode): AriaNode[] {
  return [root, ...(root.children ?? []).flatMap(child => (typeof child === 'string' ? [] : findNodes(child)))]
}

function normalizeRefs(snapshot: string, targetRef: string | undefined): string {
  return snapshot.replace(`ref=${targetRef}`, 'ref=target').replace(/ref=e\d+/g, 'ref=eN')
}
