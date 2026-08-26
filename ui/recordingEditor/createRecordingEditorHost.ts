import type { Recording } from '@te/recorder-core'

import type { RecordingEditorHostMessage, RecordingEditorUiMessage, SnapshotState } from './types.ts'

export { createRecordingEditorHost }
export type { RecordingEditorHost }

function createRecordingEditorHost(args: CreateRecordingEditorHostArgs): RecordingEditorHost {
  let selectedActionIndex = 0

  return { handleMessage, publishRecording, publishSnapshot }

  async function handleMessage(message: RecordingEditorUiMessage): Promise<RecordingEditorHostMessage[] | undefined> {
    if (message.type === 'ready') return publishRecording()

    if (message.type === 'selectAction') {
      selectedActionIndex = message.actionIndex
      return [await publishSnapshot()]
    }

    return undefined
  }

  async function publishRecording(): Promise<RecordingEditorHostMessage[]> {
    try {
      const recording = await args.readRecording()
      selectedActionIndex = Math.min(selectedActionIndex, Math.max(0, recording.actions.length - 1))

      return [{ type: 'recording', recording, pending: args.isPending(), selectedActionIndex }, await publishSnapshot(recording)]
    } catch (error) {
      return [{ type: 'error', message: getErrorMessage(error) }]
    }
  }

  async function publishSnapshot(recording?: Recording): Promise<RecordingEditorHostMessage> {
    try {
      const currentRecording = recording ?? (await args.readRecording())
      const action = currentRecording.actions[selectedActionIndex]
      const snapshot = action && 'locatorCandidates' in action ? await args.readSnapshot(selectedActionIndex) : undefined

      return { type: 'snapshot', actionIndex: selectedActionIndex, ...snapshot }
    } catch (error) {
      return { type: 'snapshot', actionIndex: selectedActionIndex, error: getErrorMessage(error) }
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface CreateRecordingEditorHostArgs {
  isPending: () => boolean
  readRecording: () => Promise<Recording> | Recording
  readSnapshot: (actionIndex: number) => Promise<SnapshotState>
}

interface RecordingEditorHost {
  handleMessage: (message: RecordingEditorUiMessage) => Promise<RecordingEditorHostMessage[] | undefined>
  publishRecording: () => Promise<RecordingEditorHostMessage[]>
  publishSnapshot: (recording?: Recording) => Promise<RecordingEditorHostMessage>
}
