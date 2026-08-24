import type { AriaSnapshot } from '@te/aria'
import type { Browser, BrowserContext, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'

import { createRecordingSession, type RecordedAriaSnapshot, type RecordingDocument } from '@te/recorder-core'
import { createRecorder, playRecording, type Recorder } from '@te/recorder-runtime'
import { installRecordingCapture, type CapturedInteractionEvent } from '@te/recorder-runtime/capture'

export { captureInteraction, createPage, playTestRecording, recordTest, useBrowserTestFixture }
export type { BrowserTestFixture, InteractionSummary }

async function captureInteraction(args: CaptureInteractionArgs): Promise<InteractionSummary> {
  const captured = Promise.withResolvers<InteractionSummary>()
  const page = await createPage({ context: args.fixture.context, documents: args.documents, headers: args.headers, html: args.html })
  const recordingSession = createRecordingSession({ startUrl: 'https://recorder.test/content', title: 'Smoke test' })

  await installRecordingCapture({
    context: args.fixture.context,
    onInteraction: async interaction => {
      if (interaction.event.kind === args.expectedKind) {
        captured.resolve({ ariaSnapshot: interaction.ariaSnapshot, frameHostname: new URL(interaction.frame.url()).hostname, kind: interaction.event.kind, selectors: interaction.selectors.filter(selector => selector.kind === 'css').map(selector => selector.value), targetRef: interaction.targetRef })
      }
    },
    page,
    recordingSession,
    startUrl: 'https://recorder.test/content',
  })

  await args.interact(page)
  return captured.promise
}

async function createPage(args: CreatePageArgs): Promise<Page> {
  const page = await args.context.newPage()
  const documents: Record<string, string | undefined> = { 'https://recorder.test/content': args.html, ...args.documents }

  await page.route('**/*', route => {
    const document = documents[route.request().url()]

    return route.fulfill({ body: document ?? 'Not found', contentType: 'text/html', headers: args.headers, status: document ? 200 : 404 })
  })
  return page
}

function createTestRecorder(args: CreateTestRecorderArgs): Recorder {
  return createRecorder({ createBrowserSession: async () => ({ browser: args.browser, close: async () => undefined, context: args.context, page: args.page }) })
}

async function playTestRecording(args: PlayTestRecordingArgs): Promise<Page> {
  const page = await createPage({ context: args.fixture.context, documents: args.documents, html: args.html })

  await playRecording({ document: args.document, session: { browser: args.fixture.browser, close: async () => undefined, context: args.fixture.context, page } })
  return page
}

async function recordTest(args: RecordTestArgs): Promise<RecordingDocument> {
  const page = await createPage({ context: args.fixture.context, documents: args.documents, html: args.html })
  const recorder = createTestRecorder({ browser: args.fixture.browser, context: args.fixture.context, page })

  await recorder.start({ onDocumentChanged: args.onDocumentChanged, onSnapshotCaptured: args.onSnapshotCaptured, startUrl: args.startUrl })
  await args.interact(page)
  const document = await recorder.stop()

  if (!document) {
    throw new Error('Expected the recorder to produce a document.')
  }

  return document
}

function useBrowserTestFixture(): BrowserTestFixture {
  const fixture = {} as BrowserTestFixture

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

  return fixture
}

interface CaptureInteractionArgs {
  documents?: Record<string, string>
  expectedKind: CapturedInteractionEvent['kind']
  fixture: BrowserTestFixture
  headers?: Record<string, string>
  html: string
  interact: (page: Page) => Promise<unknown>
}

interface CreatePageArgs {
  context: BrowserContext
  documents?: Record<string, string>
  headers?: Record<string, string>
  html?: string
}

interface CreateTestRecorderArgs {
  browser: Browser
  context: BrowserContext
  page: Page
}

interface InteractionSummary {
  ariaSnapshot: AriaSnapshot
  frameHostname: string
  kind: CapturedInteractionEvent['kind']
  selectors: string[]
  targetRef?: string
}

interface BrowserTestFixture {
  browser: Browser
  context: BrowserContext
}

interface PlayTestRecordingArgs {
  document: RecordingDocument
  documents?: Record<string, string>
  fixture: BrowserTestFixture
  html?: string
}

interface RecordTestArgs {
  documents?: Record<string, string>
  fixture: BrowserTestFixture
  html?: string
  interact: (page: Page) => Promise<unknown>
  onDocumentChanged?: (document: RecordingDocument) => Promise<void> | void
  onSnapshotCaptured?: (snapshot: { actionIndex: number; ariaSnapshot: RecordedAriaSnapshot }) => Promise<void> | void
  startUrl: string
}
