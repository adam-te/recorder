import { recordingEditorViewType } from '#recorder-extension/recording/createRecordingEditorProvider.ts'
import { randomUUID } from 'node:crypto'
import { commands, Uri, window, workspace, type ExtensionContext } from 'vscode'

import { getRecordingSnapshotFileName, parseRecordingDocument, parseRecordingSnapshot, serializeRecordingDocument, serializeRecordingSnapshot, type RecordedAriaSnapshot, type RecordingDocument } from '@te/recorder-core'
import { createRecorder } from '@te/recorder-runtime'

export { createRecorderController }
export type { RecorderController }

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function createRecorderController(args: CreateRecorderControllerArgs): RecorderController {
  const recorder = createRecorder()
  let stagingDirectory: Uri | undefined

  return { discardPending, dispose, isPending, play, savePending, start, stop }

  async function start(): Promise<void> {
    if (stagingDirectory) {
      throw new Error('Save or discard the recording preview before starting another recording.')
    }

    stagingDirectory = Uri.joinPath(args.context.storageUri ?? args.context.globalStorageUri, 'recording-staging', `${randomUUID()}.recording`)
    await workspace.fs.createDirectory(Uri.joinPath(stagingDirectory, 'snapshots'))

    try {
      await recorder.start({ onSnapshotCaptured: stageSnapshot, onStopRequested: args.onStopRequested })
    } catch (error) {
      await discardStagingDirectory()
      throw error
    }
  }

  async function stop(): Promise<void> {
    const document = await recorder.stop()

    if (!document) {
      await discardStagingDirectory()
      return
    }

    await openPreview(document)
  }

  async function play(document?: RecordingDocument): Promise<void> {
    if (!document) {
      const editor = window.activeTextEditor
      if (!editor || editor.document.uri.path.split('/').at(-1) !== 'recording.json') {
        throw new Error('Open a recording.json document before starting playback.')
      }

      document = parseRecordingDocument(JSON.parse(editor.document.getText()))
    }

    await recorder.play({ document })
    await window.showInformationMessage(`Played ${document.actions.length} recorded actions.`)
  }

  async function dispose(): Promise<void> {
    await recorder.dispose()
    await discardStagingDirectory()
  }

  function isPending(documentUri: Uri): boolean {
    return Boolean(stagingDirectory && documentUri.toString() === Uri.joinPath(stagingDirectory, 'recording.json').toString())
  }

  async function savePending(documentUri: Uri): Promise<Uri | undefined> {
    if (!stagingDirectory || !isPending(documentUri)) {
      throw new Error('This recording preview is no longer available.')
    }

    const contents = await workspace.fs.readFile(documentUri)
    const document = parseRecordingDocument(JSON.parse(decoder.decode(contents)))
    return promptToSave(document)
  }

  async function discardPending(documentUri: Uri): Promise<boolean> {
    if (!isPending(documentUri)) {
      return false
    }

    await discardStagingDirectory()
    return true
  }

  async function stageSnapshot(args: { actionIndex: number; ariaSnapshot: RecordedAriaSnapshot }): Promise<void> {
    if (!stagingDirectory) {
      throw new Error('Cannot stage a snapshot without an active recording.')
    }

    const snapshotsDirectory = Uri.joinPath(stagingDirectory, 'snapshots')
    const destination = Uri.joinPath(snapshotsDirectory, getRecordingSnapshotFileName(args.actionIndex))
    const temporary = destination.with({ path: `${destination.path}.pending` })

    await workspace.fs.writeFile(temporary, encoder.encode(serializeRecordingSnapshot(args.ariaSnapshot)))
    await workspace.fs.rename(temporary, destination, { overwrite: true })
  }

  async function openPreview(document: RecordingDocument): Promise<void> {
    if (!stagingDirectory) {
      throw new Error('Cannot preview a recording without staged files.')
    }

    const destination = Uri.joinPath(stagingDirectory, 'recording.json')
    const temporary = destination.with({ path: `${destination.path}.pending` })
    await workspace.fs.writeFile(temporary, encoder.encode(serializeRecordingDocument(document)))
    await workspace.fs.rename(temporary, destination, { overwrite: true })
    await commands.executeCommand('vscode.openWith', destination, recordingEditorViewType)
  }

  async function promptToSave(document: RecordingDocument): Promise<Uri | undefined> {
    while (stagingDirectory) {
      const destination = await window.showSaveDialog({ defaultUri: defaultRecordingUri(document), saveLabel: 'Save Recording' })
      if (!destination) {
        return undefined
      }

      const recordingDirectory = destination.path.endsWith('.recording') ? destination : destination.with({ path: `${destination.path}.recording` })
      try {
        await commitRecording({ destination: recordingDirectory, document, stagingDirectory })
        await discardStagingDirectory()

        await window.showInformationMessage(`Saved recording to ${recordingDirectory.fsPath}.`)
        return Uri.joinPath(recordingDirectory, 'recording.json')
      } catch (error) {
        const retry = await window.showErrorMessage(`Could not save recording: ${error.message}`, 'Choose Another Location', 'Cancel')
        if (retry !== 'Choose Another Location') {
          return undefined
        }
      }
    }

    return undefined
  }

  function defaultRecordingUri(document: RecordingDocument): Uri | undefined {
    const workspaceFolder = workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      return undefined
    }

    const name = document.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    return Uri.joinPath(workspaceFolder.uri, `${name || 'recording'}.recording`)
  }

  async function discardStagingDirectory(): Promise<void> {
    const currentStagingDirectory = stagingDirectory

    stagingDirectory = undefined
    if (currentStagingDirectory) {
      await workspace.fs.delete(currentStagingDirectory, { recursive: true, useTrash: false })
    }
  }
}

async function commitRecording(args: { destination: Uri; document: RecordingDocument; stagingDirectory: Uri }): Promise<void> {
  const pendingDirectory = args.destination.with({ path: `${args.destination.path}.pending-${randomUUID()}` })

  try {
    const pendingSnapshotsDirectory = Uri.joinPath(pendingDirectory, 'snapshots')
    await workspace.fs.createDirectory(pendingSnapshotsDirectory)
    await workspace.fs.writeFile(Uri.joinPath(pendingDirectory, 'recording.json'), encoder.encode(serializeRecordingDocument(args.document)))

    const stagedSnapshotsDirectory = Uri.joinPath(args.stagingDirectory, 'snapshots')
    for (const [actionIndex, action] of args.document.actions.entries()) {
      if (!('locatorCandidates' in action)) {
        continue
      }

      const name = getRecordingSnapshotFileName(actionIndex)
      const contents = await workspace.fs.readFile(Uri.joinPath(stagedSnapshotsDirectory, name))
      parseRecordingSnapshot(JSON.parse(decoder.decode(contents)))
      await workspace.fs.writeFile(Uri.joinPath(pendingSnapshotsDirectory, name), contents)
    }

    const documentContents = await workspace.fs.readFile(Uri.joinPath(pendingDirectory, 'recording.json'))
    parseRecordingDocument(JSON.parse(decoder.decode(documentContents)))
    await workspace.fs.rename(pendingDirectory, args.destination, { overwrite: false })
  } catch (error) {
    await workspace.fs.delete(pendingDirectory, { recursive: true, useTrash: false }).then(undefined, () => undefined)
    throw error
  }
}

interface RecorderController {
  discardPending: (documentUri: Uri) => Promise<boolean>
  dispose: () => Promise<void>
  isPending: (documentUri: Uri) => boolean
  play: (document?: RecordingDocument) => Promise<void>
  savePending: (documentUri: Uri) => Promise<Uri | undefined>
  start: () => Promise<void>
  stop: () => Promise<void>
}

interface CreateRecorderControllerArgs {
  context: ExtensionContext
  onStopRequested?: () => Promise<void> | void
}
