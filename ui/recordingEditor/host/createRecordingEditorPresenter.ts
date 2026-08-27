import type { RecordedAriaSnapshot, Recording } from '@te/recorder-core'
import { tryTo } from '@te/recorder-utils'

import type { RecordingEditorPresenterMessage } from '../protocol.ts'
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
        const recording = await args.readRecording()
        selectedActionIndex = Math.min(selectedActionIndex, Math.max(0, recording.actions.length - 1))

        return [{ type: 'recording' as const, recording, pending: args.isPending(), selectedActionIndex }, await publishSnapshot(recording)]
      },
      error => [{ type: 'error', message: getErrorMessage(error) }],
    )
  }

  async function publishSnapshot(recording?: Recording): Promise<RecordingEditorPresenterMessage> {
    return await tryTo(
      async () => {
        const currentRecording = recording ?? (await args.readRecording())
        const action = currentRecording.actions[selectedActionIndex]
        const snapshot = action && 'locatorCandidates' in action ? renderRecordingSnapshot(await args.readSnapshot(selectedActionIndex)) : undefined

        return { type: 'snapshot' as const, actionIndex: selectedActionIndex, ...snapshot }
      },
      error => ({ type: 'snapshot', actionIndex: selectedActionIndex, error: getErrorMessage(error) }),
    )
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface CreateRecordingEditorPresenterArgs {
  isPending: () => boolean
  readRecording: () => Promise<Recording> | Recording
  readSnapshot: (actionIndex: number) => Promise<RecordedAriaSnapshot>
}

interface RecordingEditorPresenter {
  publishRecording: () => Promise<RecordingEditorPresenterMessage[]>
  publishSnapshot: (recording?: Recording) => Promise<RecordingEditorPresenterMessage>
  ready: () => Promise<RecordingEditorPresenterMessage[]>
  selectAction: (actionIndex: number) => Promise<RecordingEditorPresenterMessage[]>
}
