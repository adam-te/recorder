import { createBrowserSession, type BrowserSession } from '#runtime/browser/createBrowserSession.ts'
import { playRecording } from '#runtime/playback/playRecording.ts'
import { createRecordingCapture, type RecordingCapture } from '#runtime/recording/host/createRecordingCapture.ts'

import type { Recording, RecordingArtifact } from '@te/recorder-core'
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

    const currentBrowserSession = await createSession()
    const currentRecording: ActiveRecording = { browserSession: currentBrowserSession }

    activeRecording = currentRecording
    await tryTo(
      async () => {
        currentRecording.capture = await createRecordingCapture({
          context: currentBrowserSession.context,
          onRecordingChanged: args.onRecordingChanged,
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

  async function stop(): Promise<RecordingArtifact | undefined> {
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

  async function play(args: PlayArgs): Promise<void> {
    const playbackSession = await createSession()

    await playRecording({ recording: args.recording, session: playbackSession }).finally(() => playbackSession.close())
  }

  async function dispose(): Promise<void> {
    await closeRecording()
  }
}

interface ActiveRecording {
  browserSession: BrowserSession
  capture?: RecordingCapture
}

interface PlayArgs {
  recording: Recording
}

interface Recorder {
  dispose: () => Promise<void>
  play: (args: PlayArgs) => Promise<void>
  start: (args: StartArgs) => Promise<void>
  stop: () => Promise<RecordingArtifact | undefined>
}

interface StartArgs {
  onRecordingChanged?: (recording: Recording) => Promise<void> | void
  onStopRequested?: () => Promise<void> | void
  startUrl: string
}

interface CreateRecorderArgs {
  createBrowserSession?: () => Promise<BrowserSession>
}
