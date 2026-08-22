import { createBrowserSession, type BrowserSession } from '#recorder-runtime/browser/createBrowserSession.ts'
import { playRecording } from '#recorder-runtime/playback/playRecording.ts'
import { installRecordingCapture, type RecordingCapture } from '#recorder-runtime/recording/installRecordingCapture/index.ts'
import { appendCapturedInteraction } from '#recorder-runtime/recording/processing/appendCapturedInteraction.ts'

import { createRecordingSession, type RecordingDocument, type RecordingSession } from '@te/recorder-core'
import { tryTo } from '@te/recorder-utils'

export { createRecorder }
export type { CreateRecorderArgs, Recorder }

function createRecorder(args: CreateRecorderArgs = {}): Recorder {
  const createSession = args.createBrowserSession ?? createBrowserSession
  let browserSession: BrowserSession | undefined
  let capture: RecordingCapture | undefined
  let recordingInitialized = false
  let recordingSession: RecordingSession | undefined

  return { dispose, play, start, stop }

  async function start(args: StartArgs = {}): Promise<void> {
    if (browserSession) {
      throw new Error('A recorder browser session is already active.')
    }

    const currentRecordingSession = createRecordingSession({ startUrl: 'about:blank', title: 'New recording' })
    let pendingDocumentChange = Promise.resolve()
    const currentBrowserSession = await createSession()

    browserSession = currentBrowserSession
    recordingInitialized = false
    recordingSession = currentRecordingSession
    await tryTo(
      async () => {
        capture = await installRecordingCapture({
          context: currentBrowserSession.context,
          onDocumentChanged: recordDocumentChange,
          onInteraction: async interaction => {
            const document = await appendCapturedInteraction({ interaction, recordingSession: currentRecordingSession })

            await (document && recordDocumentChange(document))
          },
          onStopRequested: args.onStopRequested ?? stopFromOverlay,
          page: currentBrowserSession.page,
          recordingSession: currentRecordingSession,
          startUrl: args.url,
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

    async function recordDocumentChange(document: RecordingDocument): Promise<void> {
      let currentDocument = document

      if (!recordingInitialized) {
        const initialNavigation = document.actions.find(action => action.kind === 'goto')
        if (!initialNavigation) {
          return
        }

        const url = new URL(initialNavigation.url)

        recordingInitialized = true
        currentDocument = currentRecordingSession.updateMetadata({ startUrl: initialNavigation.url, title: url.hostname || initialNavigation.url })
      }

      await notifyDocumentChanged(currentDocument)
    }
  }

  async function stop(): Promise<RecordingDocument | undefined> {
    const currentRecordingSession = recordingSession

    return await tryTo(
      async () => {
        await disposeCaptures()
        return recordingInitialized ? currentRecordingSession?.snapshot() : undefined
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
    recordingInitialized = false
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
  start: (args?: StartArgs) => Promise<void>
  stop: () => Promise<RecordingDocument | undefined>
}

interface StartArgs {
  onDocumentChanged?: (document: RecordingDocument) => Promise<void> | void
  onStopRequested?: () => Promise<void> | void
  url?: string
}

interface CreateRecorderArgs {
  createBrowserSession?: () => Promise<BrowserSession>
}
