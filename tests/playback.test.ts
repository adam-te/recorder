import { renderAriaSnapshot } from '@te/aria'
import type { Page } from 'playwright'
import { describe, expect, test } from 'vitest'

import type { RecordedAriaNode, RecordedAriaSnapshot, RecordedLocator } from '@te/recorder-core'

import { useBrowserTestHarness } from './utils.ts'

describe('recording playback', () => {
  const browser = useBrowserTestHarness()

  test('records and plays back clicks', async () => {
    const html = `<button data-testid="target" onclick="document.body.dataset.clicked = 'true'">Click</button>`
    const recordedActionCounts: number[] = []
    const document = await browser.record({
      html,
      interact: page => page.getByTestId('target').click(),
      onDocumentChanged: currentDocument => {
        recordedActionCounts.push(currentDocument.actions.length)
      },
    })

    expect(recordedActionCounts).toStrictEqual([1, 2])
    expect(document).toMatchObject({
      actions: [
        { kind: 'goto', pageUrl: 'about:blank', url: 'https://recorder.test/content' },
        { kind: 'click', pageUrl: 'https://recorder.test/content' },
      ],
      startUrl: 'https://recorder.test/content',
    })
    expect(document.actions[1] && 'locatorCandidates' in document.actions[1] ? document.actions[1].locatorCandidates.length : 0).toBeGreaterThan(0)

    const playbackPage = await browser.play({ document: { ...document, startUrl: 'https://metadata.test/not-used' }, html })

    expect(await playbackPage.locator('body').getAttribute('data-clicked')).toBe('true')
  })

  test('records and plays back key presses', async () => {
    const html = `<input id="search" onkeydown="document.body.dataset.key = event.key">`
    const document = await browser.record({ html, interact: page => page.locator('#search').press('Enter') })

    expect(document.actions).toMatchObject([
      { kind: 'goto', url: 'https://recorder.test/content' },
      { key: 'Enter', kind: 'press', pageUrl: 'https://recorder.test/content' },
    ])
    expect(document.actions[1] && 'locatorCandidates' in document.actions[1] ? document.actions[1].locatorCandidates.length : 0).toBeGreaterThan(0)

    const playbackPage = await browser.play({ document, html })

    expect(await playbackPage.locator('body').getAttribute('data-key')).toBe('Enter')
  })

  test('records and plays back interactions inside frames', async () => {
    const documents = {
      'https://frame.test/content': `<button id="target" onclick="document.body.dataset.clicked = 'true'">Click</button>`,
      'https://recorder.test/content': '<iframe id="action-frame" src="https://frame.test/content"></iframe>',
    }
    let recordedSnapshot: { actionIndex: number; ariaSnapshot: RecordedAriaSnapshot } | undefined
    const document = await browser.record({
      documents,
      interact: page => page.frameLocator('#action-frame').locator('#target').click(),
      onSnapshotCaptured: snapshot => {
        recordedSnapshot = snapshot
      },
    })

    expect(document.actions).toMatchObject([
      { kind: 'goto', pageUrl: 'about:blank', url: 'https://recorder.test/content' },
      {
        kind: 'click',
        locatorCandidates: [
          { framePath: ['#action-frame'], kind: 'aria', steps: [{ method: 'role', name: 'Click', role: 'button' }] },
          { framePath: ['#action-frame'], kind: 'css', value: '#target' },
          { framePath: ['#action-frame'], kind: 'css', value: 'button' },
        ],
        pageUrl: 'https://recorder.test/content',
      },
    ])
    const target = findTarget(recordedSnapshot?.ariaSnapshot)

    expect(recordedSnapshot?.actionIndex).toBe(1)
    expect(recordedSnapshot?.ariaSnapshot).toMatchObject({ role: 'fragment' })
    expect(document.actions[1]).not.toHaveProperty('ariaSnapshot')
    expect(document.actions[1]).not.toHaveProperty('targetRef')
    expect(target?.ref).toMatch(/^e\d+$/)
    expect(renderAriaSnapshot(recordedSnapshot!.ariaSnapshot)).toBe(`- button "Click" [active] [ref=${target?.ref}]`)

    const playbackPage = await browser.play({ document, documents })

    expect(await playbackPage.frameLocator('#action-frame').locator('body').getAttribute('data-clicked')).toBe('true')
  })

  test.each(locatorPlaybackCases)('$name', async ({ expectedClicked, expectedLocator, html, interact }) => {
    const document = await browser.record({ html, interact })
    const action = document.actions[1]

    expect(action && 'locatorCandidates' in action ? action.locatorCandidates[0] : undefined).toStrictEqual(expectedLocator)

    const playbackPage = await browser.play({ document, html })

    expect(await playbackPage.locator('body').getAttribute('data-clicked')).toBe(expectedClicked)
  })

  test('does not generate ARIA locators through hidden shadow hosts', async () => {
    const html = `<div id="host" aria-hidden="true"></div><script>document.querySelector('#host').attachShadow({ mode: 'open' }).innerHTML = '<button id="target" onclick="document.body.dataset.clicked = true">Save</button>'</script>`
    const document = await browser.record({ html, interact: page => page.locator('#target').click() })
    const action = document.actions[1]

    expect(action && 'locatorCandidates' in action ? action.locatorCandidates[0] : undefined).toMatchObject({ kind: 'css' })

    const playbackPage = await browser.play({ document, html })

    expect(await playbackPage.locator('body').getAttribute('data-clicked')).toBe('true')
  })
})

const locatorPlaybackCases: LocatorPlaybackCase[] = [
  {
    expectedClicked: 'true',
    expectedLocator: { kind: 'aria', steps: [{ method: 'label', text: 'Password' }] },
    html: `<div aria-label="Password" onclick="document.body.dataset.clicked = 'true'">Password field</div>`,
    interact: page => page.getByLabel('Password').click(),
    name: 'selects and plays back label locators',
  },
  {
    expectedClicked: 'settings',
    expectedLocator: {
      kind: 'aria',
      steps: [
        { method: 'role', name: 'Settings', role: 'dialog' },
        { method: 'role', name: 'Save', role: 'button' },
      ],
    },
    html: `<div role="dialog" aria-label="Settings"><button onclick="document.body.dataset.clicked = 'settings'">Save</button></div><div role="dialog" aria-label="Profile"><button>Save</button></div>`,
    interact: page => page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Save' }).click(),
    name: 'scopes ambiguous roles with an accessible ancestor',
  },
  {
    expectedClicked: 'true',
    expectedLocator: { kind: 'aria', steps: [{ exact: true, method: 'role', name: 'Save', role: 'button' }] },
    html: `<button id="target" onclick="document.body.dataset.clicked = 'true'">Save</button><button>Save changes</button>`,
    interact: page => page.locator('#target').click(),
    name: 'uses exact matching when default matching is ambiguous',
  },
  {
    expectedClicked: 'true',
    expectedLocator: {
      kind: 'aria',
      steps: [
        { method: 'role', name: 'Settings', role: 'dialog' },
        { exact: true, method: 'role', name: 'Save', role: 'button' },
      ],
    },
    html: `<div role="dialog" aria-label="Settings"><button id="target" onclick="document.body.dataset.clicked = 'true'">Save</button><button>Save changes</button></div><div role="dialog" aria-label="Profile"><button>Save</button></div>`,
    interact: page => page.locator('#target').click(),
    name: 'adds exact only to the target step that needs it',
  },
  {
    expectedClicked: 'true',
    expectedLocator: {
      kind: 'aria',
      steps: [
        { exact: true, method: 'role', name: 'Settings', role: 'dialog' },
        { method: 'role', name: 'Save', role: 'button' },
      ],
    },
    html: `<div role="dialog" aria-label="Settings"><button id="target" onclick="document.body.dataset.clicked = 'true'">Save</button></div><div role="dialog" aria-label="Settings advanced"><button>Save</button></div>`,
    interact: page => page.locator('#target').click(),
    name: 'adds exact only to the ancestor step that needs it',
  },
  {
    expectedClicked: 'true',
    expectedLocator: { kind: 'aria', steps: [{ method: 'role', name: 'Result', role: 'status' }] },
    html: `<span id="result-name">Result</span><output aria-labelledby="result-name" onclick="document.body.dataset.clicked = 'true'">Ready</output>`,
    interact: page => page.locator('output').click(),
    name: 'uses library-derived implicit roles and accessible names',
  },
  {
    expectedClicked: 'true',
    expectedLocator: { kind: 'aria', steps: [{ method: 'role', name: 'Save', role: 'button' }] },
    html: `<button id="target" role="unknown button" onclick="document.body.dataset.clicked = 'true'">Save</button>`,
    interact: page => page.locator('#target').click(),
    name: 'uses Playwright fallback role semantics',
  },
  {
    expectedClicked: 'true',
    expectedLocator: { kind: 'aria', steps: [{ method: 'role', name: 'Prefix Save', role: 'button' }] },
    html: `<style>#target::before { content: "Prefix "; }</style><button id="target" onclick="document.body.dataset.clicked = 'true'">Save</button>`,
    interact: page => page.locator('#target').click(),
    name: 'includes CSS generated content in accessible names',
  },
  {
    expectedClicked: 'true',
    expectedLocator: { kind: 'aria', steps: [{ method: 'label', text: 'First' }] },
    html: `<span id="first">First</span><span id="second">Second</span><div id="target" aria-labelledby="first second" onclick="document.body.dataset.clicked = 'true'">Content</div>`,
    interact: page => page.getByLabel('First', { exact: true }).click(),
    name: 'uses individual Playwright label alternatives',
  },
]

interface LocatorPlaybackCase {
  expectedClicked: string
  expectedLocator: RecordedLocator
  html: string
  interact: (page: Page) => Promise<unknown>
  name: string
}

function findTarget(snapshot: RecordedAriaSnapshot | undefined): RecordedAriaNode | undefined {
  if (!snapshot) {
    return undefined
  }

  if (snapshot.target) {
    return snapshot
  }

  for (const child of snapshot.children ?? []) {
    const target = typeof child === 'string' ? undefined : findTarget(child)
    if (target) {
      return target
    }
  }

  return undefined
}
