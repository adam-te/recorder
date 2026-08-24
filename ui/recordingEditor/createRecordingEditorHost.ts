import type { RecordingDocument } from '@te/recorder-core'

import type { RecordingEditorHostMessage, RecordingEditorUiMessage, SnapshotState } from './types.ts'

export { createRecordingEditorHost }
export type { RecordingEditorHost }

function createRecordingEditorHost(args: CreateRecordingEditorHostArgs): RecordingEditorHost {
  let selectedActionIndex = 0

  return { handleMessage, publishDocument, publishSnapshot }

  async function handleMessage(message: RecordingEditorUiMessage): Promise<RecordingEditorHostMessage[] | undefined> {
    if (message.type === 'ready') return publishDocument()

    if (message.type === 'selectAction') {
      selectedActionIndex = message.actionIndex
      return [await publishSnapshot()]
    }

    return undefined
  }

  async function publishDocument(): Promise<RecordingEditorHostMessage[]> {
    try {
      const document = await args.readDocument()
      selectedActionIndex = Math.min(selectedActionIndex, Math.max(0, document.actions.length - 1))

      return [{ type: 'document', document, pending: args.isPending(), selectedActionIndex }, await publishSnapshot(document)]
    } catch (error) {
      return [{ type: 'error', message: getErrorMessage(error) }]
    }
  }

  async function publishSnapshot(document?: RecordingDocument): Promise<RecordingEditorHostMessage> {
    try {
      const currentDocument = document ?? (await args.readDocument())
      const action = currentDocument.actions[selectedActionIndex]
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
  readDocument: () => Promise<RecordingDocument> | RecordingDocument
  readSnapshot: (actionIndex: number) => Promise<SnapshotState>
}

interface RecordingEditorHost {
  handleMessage: (message: RecordingEditorUiMessage) => Promise<RecordingEditorHostMessage[] | undefined>
  publishDocument: () => Promise<RecordingEditorHostMessage[]>
  publishSnapshot: (document?: RecordingDocument) => Promise<RecordingEditorHostMessage>
}
