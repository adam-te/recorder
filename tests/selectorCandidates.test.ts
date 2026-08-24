import type { Page } from 'playwright'
import { describe, expect, test } from 'vitest'

import { useBrowserTestHarness } from './utils.ts'

describe('CSS selector candidates', () => {
  const browser = useBrowserTestHarness()
  const getSelectors = async (args: Pick<SelectorCase, 'html' | 'interact'>): Promise<string[]> => (await browser.capture({ ...args, expectedKind: 'click' })).selectors

  const selectorCases: SelectorCase[] = [
    {
      expected: ['[data-testid="save"]', 'button'],
      html: '<button data-testid="save">Save</button>',
      interact: page => page.getByTestId('save').click(),
      name: 'prefers data-testid selectors',
    },
    {
      expected: ['#save', 'button'],
      html: '<button id="save">Save</button>',
      interact: page => page.locator('#save').click(),
      name: 'prefers ID selectors',
    },
    {
      expected: ['[href="/domains/reserved"]', 'a'],
      html: '<a href="/domains/reserved">IANA-managed Reserved Domains</a>',
      interact: page => page.locator('a').click(),
      name: 'uses unique href selectors',
    },
    {
      expected: ['[name="save"]', 'button:nth-of-type(1)'],
      html: '<button name="save">Save</button><button name="cancel">Cancel</button>',
      interact: page => page.locator('[name="save"]').click(),
      name: 'uses stable attributes',
    },
    {
      expected: ['.primary', 'button:nth-of-type(1)'],
      html: '<button class="primary">Save</button><button class="secondary">Cancel</button>',
      interact: page => page.locator('.primary').click(),
      name: 'uses unique classes',
    },
    {
      expected: ['[data-action="save"]', '.primary', '[automation="save"]'],
      html: '<button class="primary" data-action="save" automation="save">Save</button><button>Cancel</button>',
      interact: page => page.locator('.primary').click(),
      name: 'prefers data attributes over classes and classes over unknown attributes',
    },
    {
      expected: ['[automation="save"]', 'button:nth-of-type(1)'],
      html: '<button automation="save">Save</button><button>Cancel</button>',
      interact: page => page.locator('[automation="save"]').click(),
      name: 'uses unique unknown attributes before structural selectors',
    },
    {
      expected: ['#save\\:primary', 'button'],
      html: '<button id="save:primary">Save</button>',
      interact: page => page.locator('[id="save:primary"]').click(),
      name: 'escapes special characters in IDs',
    },
  ]

  selectorCases.forEach(testCase =>
    test(testCase.name, async () => {
      expect(await getSelectors(testCase)).toStrictEqual(testCase.expected)
    }),
  )

  test('limits candidates in preference order', async () => {
    const html = '<a data-testid="save" id="save" href="/save" name="save" class="primary">Save</a>'

    expect(await getSelectors({ html, interact: page => page.getByTestId('save').click() })).toStrictEqual(['[data-testid="save"]', '#save', '[href="/save"]'])
  })

  test('uses compound selectors when individual qualifiers are ambiguous', async () => {
    const html = '<button class="primary" data-testid="action">First</button><button class="secondary" data-testid="action">Second</button><button class="primary" data-testid="other">Third</button>'

    expect(await getSelectors({ html, interact: page => page.locator('[data-testid="action"].primary').click() })).toStrictEqual(['[data-testid="action"].primary', 'button:nth-of-type(1)'])
  })

  test('uses a stable ancestor when the target alone is ambiguous', async () => {
    const html = '<section id="primary"><button>Save</button></section><section><button>Save</button></section>'

    expect(await getSelectors({ html, interact: page => page.locator('#primary button').click() })).toStrictEqual(['#primary button', 'section:nth-of-type(1) button'])
  })

  test('falls back to a structural selector when stable attributes are duplicated', async () => {
    const html = '<button data-testid="target">First</button><button data-testid="target">Second</button>'

    expect(await getSelectors({ html, interact: page => page.getByTestId('target').nth(1).click() })).toStrictEqual(['button:nth-of-type(2)'])
  })

  test('composes selectors across shadow DOM boundaries', async () => {
    const html = `<div id="host"></div><script>document.querySelector('#host').attachShadow({ mode: 'open' }).innerHTML = '<button id="target">Click</button>'</script>`

    expect(await getSelectors({ html, interact: page => page.locator('#host').locator('#target').click() })).toStrictEqual(['#host #target', '#host button'])
  })
})

interface SelectorCase {
  expected: string[]
  html: string
  interact: (page: Page) => Promise<unknown>
  name: string
}
