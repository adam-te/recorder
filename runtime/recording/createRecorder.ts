import { createBrowserSession, type BrowserSession } from '#recorder-runtime/browser/createBrowserSession.ts'
import { playRecording } from '#recorder-runtime/playback/playRecording.ts'
import { installRecordingCapture, type RecordingCapture } from '#recorder-runtime/recording/installRecordingCapture/index.ts'
import { appendCapturedInteraction } from '#recorder-runtime/recording/processing/appendCapturedInteraction.ts'

import { createRecordingSession, type RecordedAriaSnapshot, type RecordingDocument, type RecordingSession } from '@te/recorder-core'
import { tryTo } from '@te/recorder-utils'

export { createRecorder }
export type { CreateRecorderArgs, Recorder }

function createRecorder(args: CreateRecorderArgs = {}): Recorder {
  const createSession = args.createBrowserSession ?? createBrowserSession
  let browserSession: BrowserSession | undefined
  let capture: RecordingCapture | undefined
  let recordingSession: RecordingSession | undefined

  return { dispose, play, start, stop }

  async function start(args: StartArgs): Promise<void> {
    if (browserSession) {
      throw new Error('A recorder browser session is already active.')
    }

    const startUrl = new URL(args.startUrl)
    const currentRecordingSession = createRecordingSession({ startUrl: args.startUrl, title: startUrl.hostname || args.startUrl })
    let pendingDocumentChange = Promise.resolve()
    const currentBrowserSession = await createSession()

    browserSession = currentBrowserSession
    recordingSession = currentRecordingSession
    await tryTo(
      async () => {
        capture = await installRecordingCapture({
          context: currentBrowserSession.context,
          onDocumentChanged: notifyDocumentChanged,
          onInteraction: async interaction => {
            const appendedInteraction = await appendCapturedInteraction({ interaction, recordingSession: currentRecordingSession })

            if (appendedInteraction) {
              await args.onSnapshotCaptured?.({ actionIndex: appendedInteraction.actionIndex, ariaSnapshot: appendedInteraction.ariaSnapshot })
              await notifyDocumentChanged(appendedInteraction.document)
            }
          },
          onStopRequested: args.onStopRequested ?? stopFromOverlay,
          page: currentBrowserSession.page,
          recordingSession: currentRecordingSession,
          startUrl: args.startUrl,
        })
      },
      async error => {
        await closeRecording()
        throw error
      },
    )

    function notifyDocumentChanged(document: RecordingDocument): Promise<void> {
      pendingDocumentChange = pendingDocumentChange.then(() => args.onDocumentChanged?.(document))

      return pendingDocumentChange
    }
  }

  async function stop(): Promise<RecordingDocument | undefined> {
    const currentRecordingSession = recordingSession

    return await tryTo(
      async () => {
        await disposeCaptures()
        return currentRecordingSession?.snapshot()
      },
      undefined,
      closeBrowserSession,
    )
  }

  async function stopFromOverlay(): Promise<void> {
    await stop()
  }

  async function closeRecording(): Promise<void> {
    await tryTo(disposeCaptures, undefined, closeBrowserSession)
  }

  async function disposeCaptures(): Promise<void> {
    const currentCapture = capture

    capture = undefined

    await currentCapture?.dispose()
  }

  async function closeBrowserSession(): Promise<void> {
    const currentBrowserSession = browserSession

    browserSession = undefined
    recordingSession = undefined
    await currentBrowserSession?.close()
  }

  async function play(args: PlayArgs): Promise<void> {
    const playbackSession = await createSession()

    await playRecording({ document: args.document, session: playbackSession }).finally(() => playbackSession.close())
  }

  async function dispose(): Promise<void> {
    await closeRecording()
  }
}

interface PlayArgs {
  document: RecordingDocument
}

interface Recorder {
  dispose: () => Promise<void>
  play: (args: PlayArgs) => Promise<void>
  start: (args: StartArgs) => Promise<void>
  stop: () => Promise<RecordingDocument | undefined>
}

interface StartArgs {
  onDocumentChanged?: (document: RecordingDocument) => Promise<void> | void
  onStopRequested?: () => Promise<void> | void
  onSnapshotCaptured?: (snapshot: CapturedSnapshot) => Promise<void> | void
  startUrl: string
}

interface CapturedSnapshot {
  actionIndex: number
  ariaSnapshot: RecordedAriaSnapshot
}

interface CreateRecorderArgs {
  createBrowserSession?: () => Promise<BrowserSession>
}
