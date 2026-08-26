import type { AriaSnapshot } from '@te/aria'
import type { Browser, BrowserContext, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'

import { createRecordingSession, type RecordedAriaSnapshot, type Recording } from '@te/recorder-core'
import { createRecorder, playRecording, type Recorder } from '@te/recorder-runtime'
import { installRecordingCapture, type CapturedInteractionEvent } from '@te/recorder-runtime/capture'

export { useBrowserTestHarness }

const defaultStartUrl = 'https://recorder.test/content'

async function captureInteraction(args: CaptureInteractionArgs): Promise<InteractionSummary> {
  const captured = Promise.withResolvers<InteractionSummary>()
  const page = await createPage({ context: args.fixture.context, documents: args.documents, headers: args.headers, html: args.html })
  const recordingSession = createRecordingSession({ startUrl: defaultStartUrl, title: 'Smoke test' })

  const recordingCapture = await installRecordingCapture({
    context: args.fixture.context,
    onInteraction: async interaction => {
      if (interaction.event.kind !== args.expectedKind) return
      captured.resolve({ ariaSnapshot: interaction.ariaSnapshot, frameHostname: new URL(interaction.frame.url()).hostname, kind: interaction.event.kind, selectors: interaction.selectors.filter(selector => selector.kind === 'css').map(selector => selector.value), targetRef: interaction.targetRef })
    },
    page,
    recordingSession,
    startUrl: defaultStartUrl,
  })
  try {
    await args.interact(page)
    return await captured.promise
  } finally {
    await recordingCapture.dispose()
  }
}

async function createPage(args: CreatePageArgs): Promise<Page> {
  const page = await args.context.newPage()
  const documents: Record<string, string | undefined> = { 'https://recorder.test/content': args.html, ...args.documents }

  await page.route('**/*', route => {
    const redirect = args.redirects?.[route.request().url()]

    if (redirect) return route.fulfill({ headers: { location: redirect }, status: 302 })

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

  await playRecording({ recording: args.recording, session: { browser: args.fixture.browser, close: async () => undefined, context: args.fixture.context, page } })
  return page
}

async function recordTest(args: RecordTestArgs): Promise<Recording> {
  const page = await createPage({ context: args.fixture.context, documents: args.documents, html: args.html, redirects: args.redirects })
  const recorder = createTestRecorder({ browser: args.fixture.browser, context: args.fixture.context, page })

  await recorder.start({ onRecordingChanged: args.onRecordingChanged, onSnapshotCaptured: args.onSnapshotCaptured, startUrl: args.startUrl })
  await args.interact(page)
  const recording = await recorder.stop()

  if (!recording) {
    throw new Error('Expected the recorder to produce a recording.')
  }

  return recording
}

function useBrowserTestHarness(): BrowserTestHarness {
  const fixture = {} as BrowserTestFixture
  const record = (args: BrowserRecordArgs): Promise<Recording> => recordTest({ ...args, fixture, startUrl: args.startUrl ?? defaultStartUrl })

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

  return {
    capture: args => captureInteraction({ ...args, fixture }),
    get context() {
      return fixture.context
    },
    page: args => createPage({ ...args, context: fixture.context }),
    play: args => playTestRecording({ ...args, fixture }),
    record,
    recordAndPlay: async args => {
      const recording = await record(args)
      const playbackPage = await playTestRecording({ documents: args.documents, fixture, html: args.html, recording })

      return { playbackPage, recording }
    },
  }
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
  redirects?: Record<string, string>
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

interface BrowserTestHarness {
  capture: (args: Omit<CaptureInteractionArgs, 'fixture'>) => Promise<InteractionSummary>
  readonly context: BrowserContext
  page: (args: Omit<CreatePageArgs, 'context'>) => Promise<Page>
  play: (args: Omit<PlayTestRecordingArgs, 'fixture'>) => Promise<Page>
  record: (args: BrowserRecordArgs) => Promise<Recording>
  recordAndPlay: (args: BrowserRecordArgs) => Promise<{ playbackPage: Page; recording: Recording }>
}

type BrowserRecordArgs = Omit<RecordTestArgs, 'fixture' | 'startUrl'> & { startUrl?: string }

interface PlayTestRecordingArgs {
  recording: Recording
  documents?: Record<string, string>
  fixture: BrowserTestFixture
  html?: string
}

interface RecordTestArgs {
  documents?: Record<string, string>
  fixture: BrowserTestFixture
  html?: string
  interact: (page: Page) => Promise<unknown>
  onRecordingChanged?: (recording: Recording) => Promise<void> | void
  onSnapshotCaptured?: (snapshot: { actionIndex: number; ariaSnapshot: RecordedAriaSnapshot }) => Promise<void> | void
  redirects?: Record<string, string>
  startUrl: string
}
