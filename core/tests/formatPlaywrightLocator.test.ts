import { describe, expect, test } from 'vitest'

import { formatPlaywrightLocator } from '@te/recorder-core'

describe('Playwright locator formatting', () => {
  test('formats locators with a page receiver by default', () => {
    expect(formatPlaywrightLocator({ kind: 'aria', steps: [{ method: 'role', name: 'Save', role: 'button' }] })).toBe('page.getByRole("button", { name: "Save" })')
    expect(formatPlaywrightLocator({ kind: 'css', value: 'body' })).toBe('page.locator("body")')
    expect(formatPlaywrightLocator({ kind: 'test-id', value: 'save' })).toBe('page.getByTestId("save")')
  })

  test('formats locators without a receiver for an implicit page scope', () => {
    expect(formatPlaywrightLocator({ kind: 'aria', steps: [{ method: 'role', name: 'Save', role: 'button' }] }, { scope: 'implicit' })).toBe('getByRole("button", { name: "Save" })')
    expect(formatPlaywrightLocator({ kind: 'css', value: 'body' }, { scope: 'implicit' })).toBe('locator("body")')
  })

  test('omits exact when the locator uses Playwright default matching', () => {
    expect(formatPlaywrightLocator({ kind: 'aria', steps: [{ method: 'role', name: 'Save', role: 'button' }] })).toBe('page.getByRole("button", { name: "Save" })')
  })

  test('formats chained role and label locators', () => {
    expect(
      formatPlaywrightLocator({
        kind: 'aria',
        steps: [
          { exact: true, method: 'role', name: 'Account', role: 'group' },
          { exact: false, method: 'label', text: 'Password' },
        ],
      }),
    ).toBe('page.getByRole("group", { name: "Account", exact: true }).getByLabel("Password", { exact: false })')
  })

  test.each([
    { expected: 'page.getByAltText("Logo")', method: 'alt' as const },
    { expected: 'page.getByPlaceholder("Search")', method: 'placeholder' as const },
    { expected: 'page.getByText("Save")', method: 'text' as const },
    { expected: 'page.getByTitle("Help")', method: 'title' as const },
  ])('formats $method locators', ({ expected, method }) => {
    expect(formatPlaywrightLocator({ kind: 'aria', steps: [{ method, text: method === 'alt' ? 'Logo' : method === 'placeholder' ? 'Search' : method === 'text' ? 'Save' : 'Help' }] })).toBe(expected)
  })

  test('uses executable frame traversal with a page receiver', () => {
    expect(formatPlaywrightLocator({ framePath: ['#outer', '#inner'], kind: 'css', value: '#target' })).toBe('page.locator("#outer").contentFrame().locator("#inner").contentFrame().locator("#target")')
  })

  test('uses receiverless frame locators for an implicit page scope', () => {
    expect(formatPlaywrightLocator({ framePath: ['#outer', '#inner'], kind: 'css', value: '#target' }, { scope: 'implicit' })).toBe('frameLocator("#outer").frameLocator("#inner").locator("#target")')
  })
})
