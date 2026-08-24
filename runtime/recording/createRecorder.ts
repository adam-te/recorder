import { createBrowserSession, type BrowserSession } from '#recorder-runtime/browser/createBrowserSession.ts'
import { playRecording } from '#recorder-runtime/playback/playRecording.ts'
import { appendCapturedInteraction } from '#recorder-runtime/recording/actions/appendCapturedInteraction.ts'
import { installRecordingInstruments } from '#recorder-runtime/recording/capture/installRecordingInstruments.ts'

import { createRecordingSession, type RecordedAriaSnapshot, type RecordingDocument, type RecordingSession } from '@te/recorder-core'
import { tryTo } from '@te/recorder-utils'

export { createRecorder }
export type { CreateRecorderArgs, Recorder }

function createRecorder(args: CreateRecorderArgs = {}): Recorder {
  const createSession = args.createBrowserSession ?? createBrowserSession
  let activeRecording: ActiveRecording | undefined

  return { dispose, play, start, stop }

  async function start(args: StartArgs): Promise<void> {
    if (activeRecording) {
      throw new Error('A recorder browser session is already active.')
    }

    const startUrl = new URL(args.startUrl)
    const currentRecordingSession = createRecordingSession({ startUrl: args.startUrl, title: startUrl.hostname || args.startUrl })
    let pendingDocumentChange = Promise.resolve()
    const currentBrowserSession = await createSession()
    const currentRecording: ActiveRecording = { browserSession: currentBrowserSession, recordingSession: currentRecordingSession }

    activeRecording = currentRecording
    await tryTo(
      async () => {
        const instruments = await installRecordingInstruments({
          context: currentBrowserSession.context,
          onInteraction: async interaction => {
            const appendedInteraction = await appendCapturedInteraction({ interaction, recordingSession: currentRecordingSession })

            if (appendedInteraction) {
              await args.onSnapshotCaptured?.({ actionIndex: appendedInteraction.actionIndex, ariaSnapshot: appendedInteraction.ariaSnapshot })
              await notifyDocumentChanged(appendedInteraction.document)
            }
          },
          onNavigation: navigation => notifyDocumentChanged(currentRecordingSession.append({ kind: 'goto', ...navigation })),
          onStopRequested: args.onStopRequested ?? stopFromOverlay,
          page: currentBrowserSession.page,
        })

        currentRecording.capture = instruments
        await currentBrowserSession.page.goto(args.startUrl)
        await instruments.flush()
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
    const currentRecordingSession = activeRecording?.recordingSession

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
    const currentCapture = activeRecording?.capture

    if (activeRecording) {
      activeRecording.capture = undefined
    }

    await currentCapture?.dispose()
  }

  async function closeBrowserSession(): Promise<void> {
    const currentRecording = activeRecording

    activeRecording = undefined
    await currentRecording?.browserSession.close()
  }

  async function play(args: PlayArgs): Promise<void> {
    const playbackSession = await createSession()

    await playRecording({ document: args.document, session: playbackSession }).finally(() => playbackSession.close())
  }

  async function dispose(): Promise<void> {
    await closeRecording()
  }
}

interface ActiveRecording {
  browserSession: BrowserSession
  capture?: ActiveRecordingCapture
  recordingSession: RecordingSession
}

interface ActiveRecordingCapture {
  dispose: () => Promise<void>
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
