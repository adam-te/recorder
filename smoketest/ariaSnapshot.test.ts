import type { Page } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { captureInteraction, useBrowserTestFixture } from './utils.ts'

describe('ARIA interaction snapshots', () => {
  const fixture = useBrowserTestFixture({ afterAll, afterEach, beforeAll, beforeEach })

  test('captures current-frame semantics and the target ref before click handlers change the page', async () => {
    const html = `
      <main aria-label="Account settings">
        <h2>Profile</h2>
        <input aria-describedby="email-help" aria-label="Email" readonly required value="ada@example.com">
        <span id="email-help">Used for notifications</span>
        <button id="target" aria-expanded="false" onclick="this.textContent = 'Changed'; this.setAttribute('aria-expanded', 'true')">Open settings</button>
        <button disabled>Unavailable</button>
        <p hidden>Secret content</p>
      </main>
    `
    const interaction = await captureInteraction({ expectedKind: 'click', fixture, html, interact: page => page.locator('#target').click() })

    expect(interaction.ariaSnapshot).toContain('- main "Account settings"')
    expect(interaction.ariaSnapshot).toContain('- heading "Profile"')
    expect(interaction.ariaSnapshot).toContain('[level=2]')
    expect(interaction.ariaSnapshot).toContain('- textbox "Email"')
    expect(interaction.ariaSnapshot).toContain(': ada@example.com')
    expect(interaction.ariaSnapshot).toContain('- text: Used for notifications')
    expect(interaction.ariaSnapshot).toContain('- button "Open settings"')
    expect(interaction.ariaSnapshot).not.toContain('[expanded]')
    expect(interaction.ariaSnapshot).toContain('- button "Unavailable"')
    expect(interaction.ariaSnapshot).toContain('[disabled]')
    expect(interaction.ariaSnapshot).not.toContain('Changed')
    expect(interaction.ariaSnapshot).not.toContain('Secret content')
    expect(interaction.ref).toMatch(/^e\d+$/)
    expect(interaction.ariaSnapshot).toContain(`[ref=${interaction.ref}]`)
  })

  test('captures the interaction frame without including the parent frame', async () => {
    const interaction = await captureInteraction({
      documents: { 'https://frame.test/content': '<main aria-label="Frame content"><button id="target">Frame action</button></main>' },
      expectedKind: 'click',
      fixture,
      html: '<main aria-label="Parent content"><iframe src="https://frame.test/content"></iframe></main>',
      interact: async page => page.frameLocator('iframe').locator('#target').click(),
    })

    expect(interaction.frameHostname).toBe('frame.test')
    expect(interaction.ariaSnapshot).toContain('Frame content')
    expect(interaction.ariaSnapshot).toContain('Frame action')
    expect(interaction.ariaSnapshot).not.toContain('Parent content')
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

    expect(interaction.ariaSnapshot).toContain('- button "Open shadow action"')
    expect(interaction.ariaSnapshot).not.toContain('- button "Closed shadow action"')
    expect(interaction.ref).toBeUndefined()
  })
})

async function clickClosedShadowButton(page: Page): Promise<void> {
  await page.mouse.click(40, 40)
}
