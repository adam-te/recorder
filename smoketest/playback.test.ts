import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { playTestRecording, recordTest, useBrowserTestFixture } from './utils.ts'

describe('recording playback', () => {
  const fixture = useBrowserTestFixture({ afterAll, afterEach, beforeAll, beforeEach })

  test('records and plays back clicks', async () => {
    const html = `<button data-testid="target" onclick="document.body.dataset.clicked = 'true'">Click</button>`
    const recordedActionCounts: number[] = []
    const document = await recordTest({
      fixture,
      html,
      interact: page => page.getByTestId('target').click(),
      onDocumentChanged: currentDocument => {
        recordedActionCounts.push(currentDocument.actions.length)
      },
      startUrl: 'https://recorder.test/content',
    })

    expect(recordedActionCounts).toStrictEqual([1, 2])
    expect(document).toMatchObject({
      actions: [
        { kind: 'goto', pageUrl: 'about:blank', url: 'https://recorder.test/content' },
        { kind: 'click', pageUrl: 'https://recorder.test/content' },
      ],
      startUrl: 'https://recorder.test/content',
    })
    expect(document?.actions[1] && 'locatorCandidates' in document.actions[1] ? document.actions[1].locatorCandidates.length : 0).toBeGreaterThan(0)

    const playbackPage = await playTestRecording({ document: { ...document!, startUrl: 'https://metadata.test/not-used' }, fixture, html })

    expect(await playbackPage.locator('body').getAttribute('data-clicked')).toBe('true')
  })

  test('records and plays back key presses', async () => {
    const html = `<input id="search" onkeydown="document.body.dataset.key = event.key">`
    const document = await recordTest({ fixture, html, interact: page => page.locator('#search').press('Enter'), startUrl: 'https://recorder.test/content' })

    expect(document?.actions).toMatchObject([
      { kind: 'goto', url: 'https://recorder.test/content' },
      { key: 'Enter', kind: 'press', pageUrl: 'https://recorder.test/content' },
    ])
    expect(document?.actions[1] && 'locatorCandidates' in document.actions[1] ? document.actions[1].locatorCandidates.length : 0).toBeGreaterThan(0)

    const playbackPage = await playTestRecording({ document, fixture, html })

    expect(await playbackPage.locator('body').getAttribute('data-key')).toBe('Enter')
  })

  test('records and plays back interactions inside frames', async () => {
    const documents = {
      'https://frame.test/content': `<button id="target" onclick="document.body.dataset.clicked = 'true'">Click</button>`,
      'https://recorder.test/content': '<iframe id="action-frame" src="https://frame.test/content"></iframe>',
    }
    const document = await recordTest({ documents, fixture, interact: page => page.frameLocator('#action-frame').locator('#target').click(), startUrl: 'https://recorder.test/content' })

    expect(document?.actions).toStrictEqual([
      { kind: 'goto', pageUrl: 'about:blank', url: 'https://recorder.test/content' },
      {
        ariaSnapshot: '- button "Click" [active] [ref=e2]',
        kind: 'click',
        locatorCandidates: [
          { framePath: ['#action-frame'], kind: 'aria', steps: [{ exact: true, method: 'role', name: 'Click', role: 'button' }] },
          { framePath: ['#action-frame'], kind: 'css', value: '#target' },
          { framePath: ['#action-frame'], kind: 'css', value: 'button' },
        ],
        pageUrl: 'https://recorder.test/content',
        ref: 'e2',
      },
    ])

    const playbackPage = await playTestRecording({ document, documents, fixture })

    expect(await playbackPage.frameLocator('#action-frame').locator('body').getAttribute('data-clicked')).toBe('true')
  })

  test('selects and plays back label locators', async () => {
    const html = `<label for="password">Password</label><input id="password" type="password" onclick="document.body.dataset.clicked = 'true'">`
    const document = await recordTest({ fixture, html, interact: page => page.getByLabel('Password').click(), startUrl: 'https://recorder.test/content' })
    const action = document?.actions[1]

    expect(action && 'locatorCandidates' in action ? action.locatorCandidates[0] : undefined).toStrictEqual({ kind: 'aria', steps: [{ exact: true, method: 'label', text: 'Password' }] })

    const playbackPage = await playTestRecording({ document, fixture, html })

    expect(await playbackPage.locator('body').getAttribute('data-clicked')).toBe('true')
  })

  test('scopes ambiguous roles with an accessible ancestor', async () => {
    const html = `<div role="dialog" aria-label="Settings"><button onclick="document.body.dataset.clicked = 'settings'">Save</button></div><div role="dialog" aria-label="Profile"><button>Save</button></div>`
    const document = await recordTest({ fixture, html, interact: page => page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Save' }).click(), startUrl: 'https://recorder.test/content' })
    const action = document?.actions[1]

    expect(action && 'locatorCandidates' in action ? action.locatorCandidates[0] : undefined).toStrictEqual({
      kind: 'aria',
      steps: [
        { exact: true, method: 'role', name: 'Settings', role: 'dialog' },
        { exact: true, method: 'role', name: 'Save', role: 'button' },
      ],
    })

    const playbackPage = await playTestRecording({ document, fixture, html })

    expect(await playbackPage.locator('body').getAttribute('data-clicked')).toBe('settings')
  })

  test('uses library-derived implicit roles and accessible names', async () => {
    const html = `<span id="result-name">Result</span><output aria-labelledby="result-name" onclick="document.body.dataset.clicked = 'true'">Ready</output>`
    const document = await recordTest({ fixture, html, interact: page => page.locator('output').click(), startUrl: 'https://recorder.test/content' })
    const action = document?.actions[1]

    expect(action && 'locatorCandidates' in action ? action.locatorCandidates[0] : undefined).toStrictEqual({ kind: 'aria', steps: [{ exact: true, method: 'role', name: 'Result', role: 'status' }] })

    const playbackPage = await playTestRecording({ document, fixture, html })

    expect(await playbackPage.locator('body').getAttribute('data-clicked')).toBe('true')
  })
})
