import { renderAriaSnapshot } from '@te/aria'
import { describe, expect, test } from 'vitest'

import type { RecordedLocator } from '@te/recorder-recording'

import { useBrowserTestHarness } from './support/browserHarness.ts'
import { getOnlyEvent } from './support/recordingAssertions.ts'

describe('interaction recording', () => {
  const browser = useBrowserTestHarness()

  test('records clicks', async () => {
    const html = `<button data-testid="target" onclick="document.body.dataset.clicked = 'true'">Click</button>`
    const recording = await browser.record({
      html,
      interact: page => page.getByTestId('target').click(),
    })

    expect(recording).toMatchObject({
      events: [
        { kind: 'goto', pageUrl: 'about:blank', url: 'https://recorder.test/content' },
        {
          kind: 'click',
          locatorCandidates: [
            { kind: 'test-id', value: 'target' },
            { kind: 'aria', steps: [{ method: 'role', name: 'Click', role: 'button' }] },
            { kind: 'css', value: 'button' },
          ],
          pageUrl: 'https://recorder.test/content',
        },
      ],
      startUrl: 'https://recorder.test/content',
    })
  })

  test('records key presses with their resulting editable values', async () => {
    const html = `<input id="search" value="old" onkeydown="document.body.dataset.key = event.key">`
    const recording = await browser.record({
      html,
      interact: async page => {
        const search = page.locator('#search')

        await search.selectText()
        await search.pressSequentially('new')
        await search.press('Backspace')
        await search.press('Enter')
      },
    })

    expect(recording.events).toMatchObject([
      { kind: 'goto', url: 'https://recorder.test/content' },
      { inputValue: 'n', key: 'n', kind: 'key-press', pageUrl: 'https://recorder.test/content' },
      { inputValue: 'ne', key: 'e', kind: 'key-press', pageUrl: 'https://recorder.test/content' },
      { inputValue: 'new', key: 'w', kind: 'key-press', pageUrl: 'https://recorder.test/content' },
      { inputValue: 'ne', key: 'Backspace', kind: 'key-press', pageUrl: 'https://recorder.test/content' },
      { key: 'Enter', kind: 'key-press', pageUrl: 'https://recorder.test/content' },
    ])
  })

  test('uses test IDs only when they are unique', async () => {
    const html = `<button data-testid="action" id="target" onclick="document.body.dataset.clicked = 'true'">Save</button><button data-testid="action">Cancel</button>`
    const recording = await browser.record({ html, interact: page => page.locator('#target').click() })
    const click = getOnlyEvent(recording, 'click')

    expect(click.locatorCandidates[0]).toStrictEqual({ kind: 'aria', steps: [{ method: 'role', name: 'Save', role: 'button' }] })
  })

  test('leaves non-standard test attributes to CSS selection', async () => {
    const html = `<div data-cy="target" id="target" style="height: 10px; width: 10px" onclick="document.body.dataset.clicked = 'true'"></div>`
    const recording = await browser.record({ html, interact: page => page.locator('#target').click() })
    const click = getOnlyEvent(recording, 'click')

    expect(click.locatorCandidates.slice(0, 2)).toStrictEqual([
      { kind: 'css', value: '#target' },
      { kind: 'css', value: '[data-cy="target"]' },
    ])
  })

  test('records frame paths on locator candidates', async () => {
    expect(
      (
        await browser.record({
          documents: frameDocuments,
          interact: page => page.frameLocator('#action-frame').locator('#target').click(),
        })
      ).events,
    ).toMatchObject([
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
  })

  test('keeps captured previews outside raw events', async () => {
    const capture = await browser.recordCapture({
      documents: frameDocuments,
      interact: page => page.frameLocator('#action-frame').locator('#target').click(),
    })
    const capturedClick = capture.events.find(({ event }) => event.kind === 'click')

    if (!capturedClick || capturedClick.event.kind !== 'click' || !capturedClick.preview) throw new Error('Expected a captured click preview.')

    expect({
      eventSnapshotKeys: Object.keys(capturedClick.event).filter(key => ['ariaSnapshot', 'targetRef'].includes(key)),
      renderedSnapshot: renderAriaSnapshot(capturedClick.preview.snapshot),
    }).toMatchObject({ eventSnapshotKeys: [], renderedSnapshot: expect.stringMatching(/^- button "Click" \[active\] \[ref=e\d+\]$/) })
    expect(Array.from(capturedClick.preview.screenshot.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  })

  test.each(locatorRecordingCases)('$name', async ({ expectedLocator, html }) => {
    const recording = await browser.record({ html, interact: page => page.locator('#target').click() })
    const click = getOnlyEvent(recording, 'click')

    expect(click.locatorCandidates[0]).toStrictEqual(expectedLocator)
  })

  test('does not generate ARIA locators through hidden shadow hosts', async () => {
    const html = `<div id="host" aria-hidden="true"></div><script>document.querySelector('#host').attachShadow({ mode: 'open' }).innerHTML = '<button id="target" onclick="document.body.dataset.clicked = true">Save</button>'</script>`
    const recording = await browser.record({ html, interact: page => page.locator('#target').click() })
    const click = getOnlyEvent(recording, 'click')

    expect(click.locatorCandidates[0]).toMatchObject({ kind: 'css' })
  })
})

const frameDocuments = {
  'https://frame.test/content': `<button id="target" onclick="document.body.dataset.clicked = 'true'">Click</button>`,
  'https://recorder.test/content': '<iframe id="action-frame" src="https://frame.test/content"></iframe>',
}

const locatorRecordingCases: LocatorRecordingCase[] = [
  {
    expectedLocator: { kind: 'aria', steps: [{ method: 'alt', text: 'Target' }] },
    html: `<div id="target" alt="Target" style="height: 10px; width: 10px" onclick="document.body.dataset.clicked = 'true'"></div>`,
    name: 'uses alt-text locators',
  },
  {
    expectedLocator: { kind: 'aria', steps: [{ method: 'label', text: 'Password' }] },
    html: `<div id="target" aria-label="Password" onclick="document.body.dataset.clicked = 'true'">Password field</div>`,
    name: 'uses label locators',
  },
  {
    expectedLocator: { kind: 'aria', steps: [{ method: 'placeholder', text: 'Search' }] },
    html: `<div id="target" placeholder="Search" style="height: 10px; width: 10px" onclick="document.body.dataset.clicked = 'true'"></div>`,
    name: 'uses placeholder locators',
  },
  {
    expectedLocator: { kind: 'aria', steps: [{ method: 'text', text: 'Target text' }] },
    html: `<div id="target" onclick="document.body.dataset.clicked = 'true'">Target text</div>`,
    name: 'uses text locators',
  },
  {
    expectedLocator: { kind: 'aria', steps: [{ method: 'text', text: 'Example DomainThis domain is' }] },
    html: `<div id="target" onclick="document.body.dataset.clicked = 'true'">Example DomainThis domain is for use in documentation examples without needing permission. Avoid use in operations.Learn more</div>`,
    name: 'prefers Playwright short text alternatives',
  },
  {
    expectedLocator: { kind: 'aria', steps: [{ method: 'text', text: 'Shared opening text remains identical for every item until alpha target details' }] },
    html: `<div id="target" onclick="document.body.dataset.clicked = 'true'">Shared opening text remains identical for every item until alpha target details continue with more words afterward</div><div>Shared opening text remains identical for every item until beta competing details continue with more words afterward</div>`,
    name: 'uses a longer Playwright text alternative when the short alternative is ambiguous',
  },
  {
    expectedLocator: {
      kind: 'aria',
      steps: [{ method: 'text', text: 'Shared opening text remains identical for every item through a deliberately long common introduction before alpha target ending' }],
    },
    html: `<div id="target" onclick="document.body.dataset.clicked = 'true'">Shared opening text remains identical for every item through a deliberately long common introduction before alpha target ending</div><div>Shared opening text remains identical for every item through a deliberately long common introduction before beta competing ending</div>`,
    name: 'retains full text as a fallback when Playwright alternatives are ambiguous',
  },
  {
    expectedLocator: { kind: 'aria', steps: [{ method: 'title', text: 'Target title' }] },
    html: `<div id="target" title="Target title" style="height: 10px; width: 10px" onclick="document.body.dataset.clicked = 'true'"></div>`,
    name: 'uses title locators',
  },
  {
    expectedLocator: {
      kind: 'aria',
      steps: [
        { method: 'role', name: 'Settings', role: 'dialog' },
        { method: 'role', name: 'Save', role: 'button' },
      ],
    },
    html: `<div role="dialog" aria-label="Settings"><button id="target" onclick="document.body.dataset.clicked = 'true'">Save</button></div><div role="dialog" aria-label="Profile"><button>Save</button></div>`,
    name: 'scopes ambiguous roles with an accessible ancestor',
  },
  {
    expectedLocator: { kind: 'aria', steps: [{ exact: true, method: 'role', name: 'Save', role: 'button' }] },
    html: `<button id="target" onclick="document.body.dataset.clicked = 'true'">Save</button><button>Save changes</button>`,
    name: 'uses exact matching when default matching is ambiguous',
  },
  {
    expectedLocator: { kind: 'aria', steps: [{ exact: true, method: 'text', text: 'Save' }] },
    html: `<div id="target" onclick="document.body.dataset.clicked = 'true'">Save</div><div>Save changes</div>`,
    name: 'uses exact matching for text locators when needed',
  },
  {
    expectedLocator: {
      kind: 'aria',
      steps: [
        { method: 'role', name: 'Settings', role: 'dialog' },
        { exact: true, method: 'role', name: 'Save', role: 'button' },
      ],
    },
    html: `<div role="dialog" aria-label="Settings"><button id="target" onclick="document.body.dataset.clicked = 'true'">Save</button><button>Save changes</button></div><div role="dialog" aria-label="Profile"><button>Save</button></div>`,
    name: 'adds exact only to the target step that needs it',
  },
  {
    expectedLocator: {
      kind: 'aria',
      steps: [
        { exact: true, method: 'role', name: 'Settings', role: 'dialog' },
        { method: 'role', name: 'Save', role: 'button' },
      ],
    },
    html: `<div role="dialog" aria-label="Settings"><button id="target" onclick="document.body.dataset.clicked = 'true'">Save</button></div><div role="dialog" aria-label="Settings advanced"><button>Save</button></div>`,
    name: 'adds exact only to the ancestor step that needs it',
  },
  {
    expectedLocator: { kind: 'aria', steps: [{ method: 'role', name: 'Result', role: 'status' }] },
    html: `<span id="result-name">Result</span><output id="target" aria-labelledby="result-name" onclick="document.body.dataset.clicked = 'true'">Ready</output>`,
    name: 'uses library-derived implicit roles and accessible names',
  },
  {
    expectedLocator: { kind: 'aria', steps: [{ method: 'role', name: 'Save', role: 'button' }] },
    html: `<button id="target" role="unknown button" onclick="document.body.dataset.clicked = 'true'">Save</button>`,
    name: 'uses Playwright fallback role semantics',
  },
  {
    expectedLocator: { kind: 'aria', steps: [{ method: 'role', name: 'Prefix Save', role: 'button' }] },
    html: `<style>#target::before { content: "Prefix "; }</style><button id="target" onclick="document.body.dataset.clicked = 'true'">Save</button>`,
    name: 'includes CSS generated content in accessible names',
  },
  {
    expectedLocator: { kind: 'aria', steps: [{ method: 'label', text: 'First' }] },
    html: `<span id="first">First</span><span id="second">Second</span><div id="target" aria-labelledby="first second" onclick="document.body.dataset.clicked = 'true'">Content</div>`,
    name: 'uses individual Playwright label alternatives',
  },
]

interface LocatorRecordingCase {
  expectedLocator: RecordedLocator
  html: string
  name: string
}
