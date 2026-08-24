import { randomUUID } from 'node:crypto'
import { Uri, window, workspace, type ExtensionContext } from 'vscode'

import { getRecordingSnapshotFileName, parseRecordingDocument, parseRecordingSnapshot, serializeRecordingDocument, serializeRecordingSnapshot, type RecordedAriaSnapshot, type RecordingDocument } from '@te/recorder-core'
import { createRecorder } from '@te/recorder-runtime'

export { createRecorderController }
export type { RecorderController }

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function createRecorderController(args: CreateRecorderControllerArgs): RecorderController {
  const recorder = createRecorder()
  let stagingDirectory: Uri | undefined

  return { dispose, play, start, stop }

  async function start(): Promise<void> {
    await discardStagingDirectory()
    stagingDirectory = Uri.joinPath(args.context.storageUri ?? args.context.globalStorageUri, 'recording-staging', randomUUID())
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

    const choice = await window.showInformationMessage(`Recorded ${document.actions.length} actions.`, { modal: true }, 'Save Recording', 'Discard')
    if (choice !== 'Save Recording') {
      await discardStagingDirectory()
      return
    }

    await promptToSave(document)
  }

  async function play(): Promise<void> {
    const editor = window.activeTextEditor
    if (!editor || editor.document.uri.path.split('/').at(-1) !== 'recording.json') {
      throw new Error('Open a recording.json document before starting playback.')
    }

    const document = parseRecordingDocument(JSON.parse(editor.document.getText()))
    await recorder.play({ document })
    await window.showInformationMessage(`Played ${document.actions.length} recorded actions.`)
  }

  async function dispose(): Promise<void> {
    await recorder.dispose()
    await discardStagingDirectory()
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

  async function promptToSave(document: RecordingDocument): Promise<void> {
    while (stagingDirectory) {
      const destination = await window.showSaveDialog({ defaultUri: defaultRecordingUri(document), saveLabel: 'Save Recording' })
      if (!destination) {
        await discardStagingDirectory()
        return
      }

      const recordingDirectory = destination.path.endsWith('.recording') ? destination : destination.with({ path: `${destination.path}.recording` })
      try {
        await commitRecording({ destination: recordingDirectory, document, stagingDirectory })
        await discardStagingDirectory()

        const savedDocument = await workspace.openTextDocument(Uri.joinPath(recordingDirectory, 'recording.json'))
        await window.showTextDocument(savedDocument, { preview: false })
        await window.showInformationMessage(`Saved recording to ${recordingDirectory.fsPath}.`)
        return
      } catch (error) {
        const retry = await window.showErrorMessage(`Could not save recording: ${error.message}`, 'Choose Another Location', 'Discard')
        if (retry !== 'Choose Another Location') {
          await discardStagingDirectory()
          return
        }
      }
    }
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
  dispose: () => Promise<void>
  play: () => Promise<void>
  start: () => Promise<void>
  stop: () => Promise<void>
}

interface CreateRecorderControllerArgs {
  context: ExtensionContext
  onStopRequested?: () => Promise<void> | void
}
