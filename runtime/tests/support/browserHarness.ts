import { createRecordingCapture } from '#runtime/recording/capture/createRecordingCapture.ts'
import type { CapturedInteractionEvent } from '#runtime/recording/capture/types.ts'
import type { AriaSnapshot } from '@te/aria'
import type { Browser, BrowserContext, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'

import type { Recording, RecordingArtifact } from '@te/recorder-core'
import { createRecorder, playRecording, type Recorder } from '@te/recorder-runtime'
import { tryTo } from '@te/recorder-utils'

export { useBrowserTestHarness }

const defaultStartUrl = 'https://recorder.test/content'

async function captureInteraction(args: CaptureInteractionArgs): Promise<InteractionSummary> {
  const captured = Promise.withResolvers<InteractionSummary>()
  const page = await createPage({ context: args.fixture.context, documents: args.documents, headers: args.headers, html: args.html })
  const recordingCapture = await createRecordingCapture({
    context: args.fixture.context,
    onInteraction: async interaction => {
      if (interaction.event.kind !== args.expectedKind) return
      captured.resolve({ ariaSnapshot: interaction.ariaSnapshot, frameHostname: new URL(interaction.frame.url()).hostname, kind: interaction.event.kind, selectors: interaction.selectors.filter(selector => selector.kind === 'css').map(selector => selector.value), targetRef: interaction.targetRef })
    },
    page,
    startUrl: defaultStartUrl,
  })
  await recordingCapture.start()
  return await tryTo(
    async () => {
      await args.interact(page)
      return await captured.promise
    },
    undefined,
    recordingCapture.dispose,
  )
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

async function recordTest(args: RecordTestArgs): Promise<RecordingArtifact> {
  const page = await createPage({ context: args.fixture.context, documents: args.documents, html: args.html, redirects: args.redirects })
  const recorder = createTestRecorder({ browser: args.fixture.browser, context: args.fixture.context, page })

  await recorder.start({ onRecordingChanged: args.onRecordingChanged, startUrl: args.startUrl })
  await args.interact(page)
  const artifact = await recorder.stop()

  if (!artifact) {
    throw new Error('Expected the recorder to produce a recording.')
  }

  return artifact
}

function useBrowserTestHarness(): BrowserTestHarness {
  const fixture = {} as BrowserTestFixture
  const recordArtifact = (args: BrowserRecordArgs): Promise<RecordingArtifact> => recordTest({ ...args, fixture, startUrl: args.startUrl ?? defaultStartUrl })
  const record = async (args: BrowserRecordArgs): Promise<Recording> => (await recordArtifact(args)).recording

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
    recordArtifact,
    recordAndPlay: async args => {
      const recording = (await recordArtifact(args)).recording
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
  recordArtifact: (args: BrowserRecordArgs) => Promise<RecordingArtifact>
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
  redirects?: Record<string, string>
  startUrl: string
}
