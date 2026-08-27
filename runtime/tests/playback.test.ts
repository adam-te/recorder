import { renderAriaSnapshot } from '@te/aria'
import { describe, expect, test } from 'vitest'

import type { RecordedAriaNode, RecordedAriaSnapshot, RecordedLocator } from '@te/recorder-core'

import { useBrowserTestHarness } from './support/browserHarness.ts'
import { getOnlyAction } from './support/recordingAssertions.ts'

describe('recording playback', () => {
  const browser = useBrowserTestHarness()

  test('records and plays back clicks', async () => {
    const html = `<button data-testid="target" onclick="document.body.dataset.clicked = 'true'">Click</button>`
    const recordedActionCounts: number[] = []
    const recording = await browser.record({
      html,
      interact: page => page.getByTestId('target').click(),
      onRecordingChanged: currentRecording => {
        recordedActionCounts.push(currentRecording.actions.length)
      },
    })

    expect(recordedActionCounts).toStrictEqual([1, 2])
    expect(recording).toMatchObject({
      actions: [
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
    const playbackPage = await browser.play({ recording: { ...recording, startUrl: 'https://metadata.test/not-used' }, html })

    expect(await playbackPage.locator('body').getAttribute('data-clicked')).toBe('true')
  })

  test('records and plays back key presses', async () => {
    const html = `<input id="search" onkeydown="document.body.dataset.key = event.key">`
    const { playbackPage, recording } = await browser.recordAndPlay({ html, interact: page => page.locator('#search').press('Enter') })

    expect(recording.actions).toMatchObject([
      { kind: 'goto', url: 'https://recorder.test/content' },
      { key: 'Enter', kind: 'press', pageUrl: 'https://recorder.test/content' },
    ])
    expect(await playbackPage.locator('body').getAttribute('data-key')).toBe('Enter')
  })

  test('uses test IDs only when they are unique', async () => {
    const html = `<button data-testid="action" id="target" onclick="document.body.dataset.clicked = 'true'">Save</button><button data-testid="action">Cancel</button>`
    const { recording } = await browser.recordAndPlay({ html, interact: page => page.locator('#target').click() })
    const click = getOnlyAction(recording, 'click')

    expect(click.locatorCandidates[0]).toStrictEqual({ kind: 'aria', steps: [{ method: 'role', name: 'Save', role: 'button' }] })
  })

  test('leaves non-standard test attributes to CSS selection', async () => {
    const html = `<div data-cy="target" id="target" style="height: 10px; width: 10px" onclick="document.body.dataset.clicked = 'true'"></div>`
    const { recording } = await browser.recordAndPlay({ html, interact: page => page.locator('#target').click() })
    const click = getOnlyAction(recording, 'click')

    expect(click.locatorCandidates.slice(0, 2)).toStrictEqual([
      { kind: 'css', value: '#target' },
      { kind: 'css', value: '[data-cy="target"]' },
    ])
  })

  test('records and plays back interactions inside frames', async () => {
    const documents = {
      'https://frame.test/content': `<button id="target" onclick="document.body.dataset.clicked = 'true'">Click</button>`,
      'https://recorder.test/content': '<iframe id="action-frame" src="https://frame.test/content"></iframe>',
    }
    let recordedSnapshot: { actionIndex: number; ariaSnapshot: RecordedAriaSnapshot } | undefined
    const { playbackPage, recording } = await browser.recordAndPlay({
      documents,
      interact: page => page.frameLocator('#action-frame').locator('#target').click(),
      onSnapshotCaptured: snapshot => {
        recordedSnapshot = snapshot
      },
    })

    expect(recording.actions).toMatchObject([
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
    const click = getOnlyAction(recording, 'click')
    const target = findTarget(recordedSnapshot?.ariaSnapshot)

    expect(recordedSnapshot?.actionIndex).toBe(1)
    expect(recordedSnapshot?.ariaSnapshot).toMatchObject({ role: 'fragment' })
    expect(click).not.toHaveProperty('ariaSnapshot')
    expect(click).not.toHaveProperty('targetRef')
    expect(target?.ref).toMatch(/^e\d+$/)
    expect(renderAriaSnapshot(recordedSnapshot!.ariaSnapshot)).toBe(`- button "Click" [active] [ref=${target?.ref}]`)

    expect(await playbackPage.frameLocator('#action-frame').locator('body').getAttribute('data-clicked')).toBe('true')
  })

  test.each(locatorPlaybackCases)('$name', async ({ expectedLocator, html }) => {
    const { playbackPage, recording } = await browser.recordAndPlay({ html, interact: page => page.locator('#target').click() })
    const click = getOnlyAction(recording, 'click')

    expect(click.locatorCandidates[0]).toStrictEqual(expectedLocator)
    expect(await playbackPage.locator('body').getAttribute('data-clicked')).toBe('true')
  })

  test('does not generate ARIA locators through hidden shadow hosts', async () => {
    const html = `<div id="host" aria-hidden="true"></div><script>document.querySelector('#host').attachShadow({ mode: 'open' }).innerHTML = '<button id="target" onclick="document.body.dataset.clicked = true">Save</button>'</script>`
    const { recording } = await browser.recordAndPlay({ html, interact: page => page.locator('#target').click() })
    const click = getOnlyAction(recording, 'click')

    expect(click.locatorCandidates[0]).toMatchObject({ kind: 'css' })
  })
})

const locatorPlaybackCases: LocatorPlaybackCase[] = [
  {
    expectedLocator: { kind: 'aria', steps: [{ method: 'alt', text: 'Target' }] },
    html: `<div id="target" alt="Target" style="height: 10px; width: 10px" onclick="document.body.dataset.clicked = 'true'"></div>`,
    name: 'selects and plays back alt-text locators',
  },
  {
    expectedLocator: { kind: 'aria', steps: [{ method: 'label', text: 'Password' }] },
    html: `<div id="target" aria-label="Password" onclick="document.body.dataset.clicked = 'true'">Password field</div>`,
    name: 'selects and plays back label locators',
  },
  {
    expectedLocator: { kind: 'aria', steps: [{ method: 'placeholder', text: 'Search' }] },
    html: `<div id="target" placeholder="Search" style="height: 10px; width: 10px" onclick="document.body.dataset.clicked = 'true'"></div>`,
    name: 'selects and plays back placeholder locators',
  },
  {
    expectedLocator: { kind: 'aria', steps: [{ method: 'text', text: 'Target text' }] },
    html: `<div id="target" onclick="document.body.dataset.clicked = 'true'">Target text</div>`,
    name: 'selects and plays back text locators',
  },
  {
    expectedLocator: { kind: 'aria', steps: [{ method: 'title', text: 'Target title' }] },
    html: `<div id="target" title="Target title" style="height: 10px; width: 10px" onclick="document.body.dataset.clicked = 'true'"></div>`,
    name: 'selects and plays back title locators',
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

interface LocatorPlaybackCase {
  expectedLocator: RecordedLocator
  html: string
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
