import { type AriaNode, renderAriaSnapshot } from '@te/aria'
import type { Page } from 'playwright'
import { describe, expect, test } from 'vitest'

import { captureInteraction, useBrowserTestFixture } from './utils.ts'

describe('ARIA interaction snapshots', () => {
  const fixture = useBrowserTestFixture()

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
    const interaction = await captureInteraction({ expectedKind: 'click', fixture, html, interact: page => page.locator('#target').click() })
    const yaml = renderAriaSnapshot(interaction.ariaSnapshot)

    expect(yaml).toContain('- main "Account settings"')
    expect(yaml).toContain('- heading "Profile"')
    expect(yaml).toContain('[level=2]')
    expect(yaml).toContain('- textbox "Email"')
    expect(yaml).toContain('[invalid=grammar]')
    expect(yaml).toContain(': ada@example.com')
    expect(yaml).toContain('- text: Used for notifications')
    expect(yaml).toContain('- button "Open settings"')
    expect(yaml).not.toContain('[expanded]')
    expect(yaml).toContain('- button "Unavailable"')
    expect(yaml).toContain('[disabled]')
    expect(yaml).not.toContain('Changed')
    expect(yaml).not.toContain('Secret content')
    expect(interaction.targetRef).toMatch(/^e\d+$/)
    expect(yaml).toContain(`[ref=${interaction.targetRef}]`)
    expect(findNodes(interaction.ariaSnapshot).every(node => !('ariaVisible' in node) && !('box' in node) && !('receivesPointerEvents' in node))).toBe(true)
  })

  test('captures the interaction frame without including the parent frame', async () => {
    const interaction = await captureInteraction({
      documents: { 'https://frame.test/content': '<main aria-label="Frame content"><button id="target">Frame action</button></main>' },
      expectedKind: 'click',
      fixture,
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
    const interaction = await captureInteraction({ expectedKind: 'click', fixture, html, interact: clickClosedShadowButton })
    const yaml = renderAriaSnapshot(interaction.ariaSnapshot)

    expect(yaml).toContain('- button "Open shadow action"')
    expect(yaml).not.toContain('- button "Closed shadow action"')
    expect(interaction.targetRef).toBeUndefined()
  })

  test('selects the nearest actionable ARIA ancestor of the raw event target', async () => {
    const html = '<button id="action"><span id="target">Save</span></button>'
    const interaction = await captureInteraction({ expectedKind: 'click', fixture, html, interact: page => page.locator('#target').click() })
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
