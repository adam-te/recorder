import { formatLocator } from '#runtime/injected/locators/formatLocator.ts'
import { describe, expect, test } from 'vitest'

describe('locator presentation', () => {
  test('omits exact when the locator uses Playwright default matching', () => {
    expect(formatLocator({ kind: 'aria', steps: [{ method: 'role', name: 'Save', role: 'button' }] })).toBe('getByRole("button", { name: "Save" })')
  })

  test('formats a named role locator as Playwright code', () => {
    expect(formatLocator({ kind: 'aria', steps: [{ exact: true, method: 'role', name: 'Save', role: 'button' }] })).toBe('getByRole("button", { name: "Save", exact: true })')
  })

  test('formats a chained label locator as Playwright code', () => {
    expect(
      formatLocator({
        kind: 'aria',
        steps: [
          { exact: true, method: 'role', name: 'Account', role: 'group' },
          { exact: true, method: 'label', text: 'Password' },
        ],
      }),
    ).toBe('getByRole("group", { name: "Account", exact: true }).getByLabel("Password", { exact: true })')
  })

  test('formats a CSS fallback as a Playwright locator', () => {
    expect(formatLocator({ kind: 'css', value: 'body' })).toBe('locator("body")')
  })
})
