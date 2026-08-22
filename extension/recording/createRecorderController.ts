import { Range, Uri, window, workspace, WorkspaceEdit, type TextDocument } from 'vscode'

import { parseRecordingDocument, serializeRecordingDocument, type RecordingDocument } from '@te/recorder-core'
import { createRecorder } from '@te/recorder-runtime'

export { createRecorderController }
export type { RecorderController }

function createRecorderController(args: CreateRecorderControllerArgs = {}): RecorderController {
  const recorder = createRecorder()
  let recordingDocument: TextDocument | undefined

  return { dispose, play, start, stop }

  async function start(): Promise<void> {
    await recorder.start({ onDocumentChanged: updateRecordingDocument, onStopRequested: args.onStopRequested })
  }

  async function stop(): Promise<void> {
    const document = await recorder.stop()

    recordingDocument = undefined
    if (!document) {
      return
    }

    await window.showInformationMessage(`Recorded ${document.actions.length} actions. Save the recording document to keep it.`)
  }

  async function play(): Promise<void> {
    const editor = window.activeTextEditor
    if (!editor) {
      throw new Error('Open a recorder document before starting playback.')
    }

    const document = parseRecordingDocument(JSON.parse(editor.document.getText()))
    await recorder.play({ document })
    await window.showInformationMessage(`Played ${document.actions.length} recorded actions.`)
  }

  async function dispose(): Promise<void> {
    await recorder.dispose()
  }

  async function openRecordingDocument(): Promise<TextDocument> {
    const activeDocumentUri = window.activeTextEditor?.document.uri
    const workspaceFolder = (activeDocumentUri && workspace.getWorkspaceFolder(activeDocumentUri)) ?? workspace.workspaceFolders?.[0]
    const document = workspaceFolder ? await workspace.openTextDocument(Uri.joinPath(workspaceFolder.uri, 'recording.json').with({ scheme: 'untitled' })) : await workspace.openTextDocument({ language: 'json' })

    await window.showTextDocument(document, { preserveFocus: true, preview: false })

    return document
  }

  async function updateRecordingDocument(document: RecordingDocument): Promise<void> {
    recordingDocument ??= await openRecordingDocument()

    if (!recordingDocument || recordingDocument.isClosed) {
      throw new Error('Cannot update a recording document that is not open.')
    }

    const edit = new WorkspaceEdit()
    const currentText = recordingDocument.getText()

    edit.replace(recordingDocument.uri, new Range(recordingDocument.positionAt(0), recordingDocument.positionAt(currentText.length)), serializeRecordingDocument(document))
    if (!(await workspace.applyEdit(edit))) {
      throw new Error('Failed to update the recording document.')
    }
  }
}

interface RecorderController {
  dispose: () => Promise<void>
  play: () => Promise<void>
  start: () => Promise<void>
  stop: () => Promise<void>
}

interface CreateRecorderControllerArgs {
  onStopRequested?: () => Promise<void> | void
}
