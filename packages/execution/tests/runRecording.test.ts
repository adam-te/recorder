import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { runRecording } from '@te/recorder-execution'
import type { ActionStep, RecordedLocator, RecordingSteps } from '@te/recorder-recording'

describe('recording execution', () => {
  const browser = useExecutionBrowser()

  test('runs initial navigation and subsequent actions', async () => {
    const page = await browser.run({
      html: `<button data-testid="target" onclick="document.body.dataset.clicked = 'true'">Click</button>`,
      steps: createTestSteps([
        { kind: 'goto', pageUrl: 'about:blank', url: contentUrl },
        { kind: 'click', locatorCandidates: [{ kind: 'test-id', value: 'target' }], pageUrl: contentUrl },
      ]),
    })

    expect(await page.locator('body').getAttribute('data-clicked')).toBe('true')
  })

  test('runs key presses', async () => {
    const page = await browser.run({
      html: `<input id="search" onkeydown="document.body.dataset.key = event.key">`,
      steps: createTestSteps([
        { kind: 'goto', pageUrl: 'about:blank', url: contentUrl },
        { key: 'Enter', kind: 'press', locatorCandidates: [{ kind: 'css', value: '#search' }], pageUrl: contentUrl },
      ]),
    })

    expect(await page.locator('body').getAttribute('data-key')).toBe('Enter')
  })

  test('runs interactions inside frames', async () => {
    const page = await browser.run({
      documents: frameDocuments,
      steps: createTestSteps([
        { kind: 'goto', pageUrl: 'about:blank', url: contentUrl },
        { kind: 'click', locatorCandidates: [{ framePath: ['#action-frame'], kind: 'css', value: '#target' }], pageUrl: contentUrl },
      ]),
    })

    expect(await page.frameLocator('#action-frame').locator('body').getAttribute('data-clicked')).toBe('true')
  })

  test.each(locatorExecutionCases)('$name', async ({ html, locator }) => {
    const page = await browser.run({
      html,
      steps: createTestSteps([
        { kind: 'goto', pageUrl: 'about:blank', url: contentUrl },
        { kind: 'click', locatorCandidates: [locator], pageUrl: contentUrl },
      ]),
    })

    expect(await page.locator('body').getAttribute('data-clicked')).toBe('true')
  })

  test('follows redirects from the initial navigation step', async () => {
    const page = await browser.run({
      documents: redirectingStartDocuments,
      steps: createTestSteps([
        { kind: 'goto', pageUrl: 'about:blank', url: 'https://recorder.test/start' },
        { kind: 'click', locatorCandidates: [{ kind: 'css', value: '#target' }], pageUrl: 'https://recorder.test/after' },
      ]),
    })

    expect(await page.locator('body').getAttribute('data-clicked')).toBe('true')
  })

  test('runs subsequent navigation actions', async () => {
    const page = await browser.run({
      documents: navigationDocuments,
      steps: createTestSteps([
        { kind: 'goto', pageUrl: 'about:blank', url: contentUrl },
        { kind: 'goto', pageUrl: contentUrl, url: 'https://recorder.test/after' },
      ]),
    })

    expect(page.url()).toBe('https://recorder.test/after')
  })
})

const contentUrl = 'https://recorder.test/content'
const frameDocuments = {
  'https://frame.test/content': `<button id="target" onclick="document.body.dataset.clicked = 'true'">Click</button>`,
  [contentUrl]: '<iframe id="action-frame" src="https://frame.test/content"></iframe>',
}
const navigationDocuments = { 'https://recorder.test/after': '<p>After</p>', [contentUrl]: '<p>Before</p>' }
const redirectingStartDocuments = {
  'https://recorder.test/after': `<button id="target" onclick="document.body.dataset.clicked = 'true'">Continue</button>`,
  'https://recorder.test/start': `<script>location.replace('https://recorder.test/after')</script>`,
}

const locatorExecutionCases: LocatorExecutionCase[] = [
  {
    html: `<div id="target" alt="Target" style="height: 10px; width: 10px" onclick="document.body.dataset.clicked = 'true'"></div>`,
    locator: { kind: 'aria', steps: [{ method: 'alt', text: 'Target' }] },
    name: 'runs alt-text locators',
  },
  {
    html: `<div id="target" aria-label="Password" onclick="document.body.dataset.clicked = 'true'">Password field</div>`,
    locator: { kind: 'aria', steps: [{ method: 'label', text: 'Password' }] },
    name: 'runs label locators',
  },
  {
    html: `<div id="target" placeholder="Search" style="height: 10px; width: 10px" onclick="document.body.dataset.clicked = 'true'"></div>`,
    locator: { kind: 'aria', steps: [{ method: 'placeholder', text: 'Search' }] },
    name: 'runs placeholder locators',
  },
  {
    html: `<div id="target" onclick="document.body.dataset.clicked = 'true'">Target text</div>`,
    locator: { kind: 'aria', steps: [{ method: 'text', text: 'Target text' }] },
    name: 'runs text locators',
  },
  {
    html: `<div id="target" title="Target title" style="height: 10px; width: 10px" onclick="document.body.dataset.clicked = 'true'"></div>`,
    locator: { kind: 'aria', steps: [{ method: 'title', text: 'Target title' }] },
    name: 'runs title locators',
  },
  {
    html: `<div role="dialog" aria-label="Settings"><button id="target" onclick="document.body.dataset.clicked = 'true'">Save</button></div><div role="dialog" aria-label="Profile"><button>Save</button></div>`,
    locator: {
      kind: 'aria',
      steps: [
        { method: 'role', name: 'Settings', role: 'dialog' },
        { method: 'role', name: 'Save', role: 'button' },
      ],
    },
    name: 'runs nested role locators',
  },
  {
    html: `<button id="target" onclick="document.body.dataset.clicked = 'true'">Save</button><button>Save changes</button>`,
    locator: { kind: 'aria', steps: [{ exact: true, method: 'role', name: 'Save', role: 'button' }] },
    name: 'runs exact role locators',
  },
  {
    html: `<div id="target" onclick="document.body.dataset.clicked = 'true'">Save</div><div>Save changes</div>`,
    locator: { kind: 'aria', steps: [{ exact: true, method: 'text', text: 'Save' }] },
    name: 'runs exact text locators',
  },
  {
    html: `<div role="dialog" aria-label="Settings"><button id="target" onclick="document.body.dataset.clicked = 'true'">Save</button><button>Save changes</button></div><div role="dialog" aria-label="Profile"><button>Save</button></div>`,
    locator: {
      kind: 'aria',
      steps: [
        { method: 'role', name: 'Settings', role: 'dialog' },
        { exact: true, method: 'role', name: 'Save', role: 'button' },
      ],
    },
    name: 'runs exact nested target locators',
  },
  {
    html: `<div role="dialog" aria-label="Settings"><button id="target" onclick="document.body.dataset.clicked = 'true'">Save</button></div><div role="dialog" aria-label="Settings advanced"><button>Save</button></div>`,
    locator: {
      kind: 'aria',
      steps: [
        { exact: true, method: 'role', name: 'Settings', role: 'dialog' },
        { method: 'role', name: 'Save', role: 'button' },
      ],
    },
    name: 'runs exact nested ancestor locators',
  },
  {
    html: `<span id="result-name">Result</span><output id="target" aria-labelledby="result-name" onclick="document.body.dataset.clicked = 'true'">Ready</output>`,
    locator: { kind: 'aria', steps: [{ method: 'role', name: 'Result', role: 'status' }] },
    name: 'runs implicit role locators',
  },
  {
    html: `<button id="target" role="unknown button" onclick="document.body.dataset.clicked = 'true'">Save</button>`,
    locator: { kind: 'aria', steps: [{ method: 'role', name: 'Save', role: 'button' }] },
    name: 'runs fallback role locators',
  },
  {
    html: `<style>#target::before { content: "Prefix "; }</style><button id="target" onclick="document.body.dataset.clicked = 'true'">Save</button>`,
    locator: { kind: 'aria', steps: [{ method: 'role', name: 'Prefix Save', role: 'button' }] },
    name: 'runs generated-content role locators',
  },
  {
    html: `<span id="first">First</span><span id="second">Second</span><div id="target" aria-labelledby="first second" onclick="document.body.dataset.clicked = 'true'">Content</div>`,
    locator: { kind: 'aria', steps: [{ method: 'label', text: 'First' }] },
    name: 'runs individual label-alternative locators',
  },
]

function createTestSteps(actions: ActionStep[]): RecordingSteps {
  return actions
}

function useExecutionBrowser(): ExecutionBrowser {
  const fixture = {} as ExecutionBrowserFixture

  beforeAll(async () => {
    fixture.browser = await chromium.launch({ headless: true })
  })
  beforeEach(async () => {
    fixture.context = await fixture.browser.newContext()
  })
  afterEach(async () => {
    await fixture.context.close()
  })
  afterAll(async () => {
    await fixture.browser.close()
  })

  return { run }

  async function run(args: RunTestRecordingArgs): Promise<Page> {
    const page = await fixture.context.newPage()
    const documents: Record<string, string | undefined> = { [contentUrl]: args.html, ...args.documents }

    await page.route('**/*', route => {
      const document = documents[route.request().url()]

      return route.fulfill({ body: document ?? 'Not found', contentType: 'text/html', status: document ? 200 : 404 })
    })
    await runRecording({ createBrowserSession: async () => ({ browser: fixture.browser, close: async () => undefined, context: fixture.context, page }), steps: args.steps })

    return page
  }
}

interface ExecutionBrowser {
  run: (args: RunTestRecordingArgs) => Promise<Page>
}

interface ExecutionBrowserFixture {
  browser: Browser
  context: BrowserContext
}

interface LocatorExecutionCase {
  html: string
  locator: RecordedLocator
  name: string
}

interface RunTestRecordingArgs {
  documents?: Record<string, string>
  html?: string
  steps: RecordingSteps
}
