import type { RecordingEditorPresenterMessage } from '#ui/recordingEditor/protocol.ts'

import { getActionSteps, type RecordedAriaSnapshot, type Recording, type RecordingSteps } from '@te/recorder-recording'
import { tryTo } from '@te/recorder-utils'

import { renderRecordingSnapshot } from './renderRecordingSnapshot.ts'

export { createRecordingEditorPresenter }
export type { RecordingEditorPresenter }

function createRecordingEditorPresenter(args: CreateRecordingEditorPresenterArgs): RecordingEditorPresenter {
  let selectedActionIndex = 0

  return { publishRecording, publishSnapshot, ready: publishRecording, selectAction }

  async function selectAction(actionIndex: number): Promise<RecordingEditorPresenterMessage[]> {
    selectedActionIndex = actionIndex

    return [await publishSnapshot()]
  }

  async function publishRecording(): Promise<RecordingEditorPresenterMessage[]> {
    return await tryTo(
      async () => {
        const [recording, steps] = await Promise.all([args.readRecording(), args.readSteps()])
        selectedActionIndex = Math.min(selectedActionIndex, Math.max(0, getActionSteps(steps).length - 1))

        return [{ type: 'recording' as const, metadata: { createdAt: recording.createdAt, startUrl: recording.startUrl, title: recording.title }, steps, pending: args.isPending(), selectedActionIndex }, await publishSnapshot(steps)]
      },
      error => [{ type: 'error', message: getErrorMessage(error) }],
    )
  }

  async function publishSnapshot(steps?: RecordingSteps): Promise<RecordingEditorPresenterMessage> {
    return await tryTo(
      async () => {
        const action = getActionSteps(steps ?? (await args.readSteps()))[selectedActionIndex]
        if (!action || !('locatorCandidates' in action)) return { type: 'preview', actionIndex: selectedActionIndex }

        const snapshot = await tryTo(
          async () => renderRecordingSnapshot(await args.readSnapshot(selectedActionIndex)),
          error => ({ snapshotError: getErrorMessage(error) }),
        )

        return { type: 'preview', actionIndex: selectedActionIndex, screenshotUrl: args.resolveScreenshotUrl(selectedActionIndex), ...snapshot }
      },
      error => ({ type: 'preview', actionIndex: selectedActionIndex, snapshotError: getErrorMessage(error) }),
    )
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface CreateRecordingEditorPresenterArgs {
  isPending: () => boolean
  readRecording: () => Promise<Recording> | Recording
  readSteps: () => Promise<RecordingSteps> | RecordingSteps
  readSnapshot: (actionIndex: number) => Promise<RecordedAriaSnapshot>
  resolveScreenshotUrl: (actionIndex: number) => string
}

interface RecordingEditorPresenter {
  publishRecording: () => Promise<RecordingEditorPresenterMessage[]>
  publishSnapshot: (steps?: RecordingSteps) => Promise<RecordingEditorPresenterMessage>
  ready: () => Promise<RecordingEditorPresenterMessage[]>
  selectAction: (actionIndex: number) => Promise<RecordingEditorPresenterMessage[]>
}
