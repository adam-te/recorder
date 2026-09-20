import { createRecordingCapture, type RecordingCapture } from '#capture/host/createRecordingCapture.ts'

import type { CapturedRecording } from '@te/recorder-recording'
import { tryTo } from '@te/recorder-utils'
import { createBrowserSession, type BrowserSession } from '@te/recorder-utils/playwright'

export { createRecorder }
export type { CreateRecorderArgs, Recorder }

function createRecorder(args: CreateRecorderArgs = {}): Recorder {
  const createSession = args.createBrowserSession ?? createBrowserSession
  let activeRecording: ActiveRecording | undefined

  return { dispose, start, stop }

  async function start(args: StartArgs): Promise<void> {
    if (activeRecording) {
      throw new Error('A recorder browser session is already active.')
    }

    const currentBrowserSession = await createSession()
    const currentRecording: ActiveRecording = { browserSession: currentBrowserSession }

    activeRecording = currentRecording
    await tryTo(
      async () => {
        currentRecording.capture = await createRecordingCapture({
          context: currentBrowserSession.context,
          onStopRequested: args.onStopRequested ?? stopFromOverlay,
          page: currentBrowserSession.page,
          startUrl: args.startUrl,
        })
        await currentRecording.capture.start()
      },
      async error => {
        await closeRecording()
        throw error
      },
    )
  }

  async function stop(): Promise<CapturedRecording | undefined> {
    const currentCapture = activeRecording?.capture

    return await tryTo(
      async () => {
        await disposeCaptures()
        return currentCapture?.snapshot()
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

  async function dispose(): Promise<void> {
    await closeRecording()
  }
}

interface ActiveRecording {
  browserSession: BrowserSession
  capture?: RecordingCapture
}

interface Recorder {
  dispose: () => Promise<void>
  start: (args: StartArgs) => Promise<void>
  stop: () => Promise<CapturedRecording | undefined>
}

interface StartArgs {
  onStopRequested?: () => Promise<void> | void
  startUrl: string
}

interface CreateRecorderArgs {
  createBrowserSession?: () => Promise<BrowserSession>
}
