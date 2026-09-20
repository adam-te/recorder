import { createRawEvent } from '#capture/host/actions/createRawEvent.ts'
import { installRecordingInstruments } from '#capture/host/installRecordingInstruments.ts'
import type { CapturedInteraction } from '#capture/host/types.ts'
import type { BrowserContext, Page } from 'playwright'

import type { CapturedPreview, CapturedRawEvent, CapturedRecording, RawEvent, RecordingMetadata } from '@te/recorder-recording'
import { tryTo } from '@te/recorder-utils'

export { createRecordingCapture }
export type { CreateRecordingCaptureArgs, RecordingCapture }

async function createRecordingCapture(args: CreateRecordingCaptureArgs): Promise<RecordingCapture> {
  const startUrl = new URL(args.startUrl)
  const metadata: RecordingMetadata = { createdAt: new Date().toISOString(), startUrl: args.startUrl, title: startUrl.hostname || args.startUrl }
  const capturedEvents: CapturedRawEvent[] = []
  let completed = false
  let disposed = false
  const instruments = await installRecordingInstruments({
    context: args.context,
    onInteraction: async interaction => {
      const screenshot = interaction.page.screenshot({ animations: 'disabled', caret: 'hide' })
      await args.onInteraction?.(interaction)
      const capturedInteraction = await createRawEvent(interaction)
      const capturedEvent: PendingCapturedRawEvent = { event: capturedInteraction.event }

      capturedEvents.push(capturedEvent)
      capturedEvent.preview = { screenshot: await screenshot, snapshot: capturedInteraction.ariaSnapshot }
    },
    onNavigation: navigation => appendNavigation({ kind: 'goto', ...navigation }),
    onStopRequested: args.onStopRequested,
    page: args.page,
  })

  return { dispose, snapshot, start }

  async function start(): Promise<void> {
    await tryTo(
      async () => {
        await args.page.goto(args.startUrl)
        await instruments.flush()
      },
      async error => {
        await dispose()
        throw error
      },
    )
  }

  async function dispose(): Promise<void> {
    if (disposed) return
    disposed = true
    await instruments.dispose()
    completed = true
  }

  function appendNavigation(event: RawEvent): void {
    capturedEvents.push({ event })
  }

  function snapshot(): CapturedRecording {
    if (!completed) throw new Error('Cannot snapshot an active recording capture.')

    return { events: capturedEvents.map(event => ({ ...event })), metadata }
  }
}

interface PendingCapturedRawEvent {
  event: RawEvent
  preview?: CapturedPreview
}

interface CreateRecordingCaptureArgs {
  context: BrowserContext
  onInteraction?: (interaction: CapturedInteraction) => Promise<void> | void
  onStopRequested?: () => Promise<void> | void
  page: Page
  startUrl: string
}

interface RecordingCapture {
  dispose: () => Promise<void>
  snapshot: () => CapturedRecording
  start: () => Promise<void>
}
