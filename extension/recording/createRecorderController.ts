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
      throw new Error('A recording is already in progress.')
    }

    stagingDirectory = Uri.joinPath(getDraftRoot(), getDraftDirectoryName())
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
    return getDraftRoots().some(root => isDraftDocumentInRoot(documentUri, root))
  }

  async function savePending(documentUri: Uri): Promise<Uri | undefined> {
    if (!isPending(documentUri)) {
      throw new Error('This recording preview is no longer available.')
    }

    const contents = await workspace.fs.readFile(documentUri)
    const document = parseRecordingDocument(JSON.parse(decoder.decode(contents)))
    return promptToSave({ document, draftDirectory: Uri.joinPath(documentUri, '..') })
  }

  async function discardPending(documentUri: Uri): Promise<boolean> {
    if (!isPending(documentUri)) {
      return false
    }

    await workspace.fs.delete(Uri.joinPath(documentUri, '..'), { recursive: true, useTrash: false })
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
    stagingDirectory = undefined
    await commands.executeCommand('vscode.openWith', destination, recordingEditorViewType)
  }

  async function promptToSave(args: { document: RecordingDocument; draftDirectory: Uri }): Promise<Uri | undefined> {
    while (isPending(Uri.joinPath(args.draftDirectory, 'recording.json'))) {
      const destination = await window.showSaveDialog({ defaultUri: defaultRecordingUri(args.document, args.draftDirectory), saveLabel: 'Save Recording' })
      if (!destination) {
        return undefined
      }

      const recordingDirectory = destination.path.endsWith('.recording') ? destination : destination.with({ path: `${destination.path}.recording` })
      try {
        await commitRecording({ destination: recordingDirectory, document: args.document, stagingDirectory: args.draftDirectory })
        await workspace.fs.delete(args.draftDirectory, { recursive: true, useTrash: false })

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

  function defaultRecordingUri(document: RecordingDocument, draftDirectory: Uri): Uri | undefined {
    const workspaceFolder = workspace.getWorkspaceFolder(draftDirectory) ?? workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      return undefined
    }

    const name = document.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    return Uri.joinPath(workspaceFolder.uri, `${name || 'recording'}.recording`)
  }

  function getDraftRoot(): Uri {
    const activeDocumentUri = window.activeTextEditor?.document.uri
    const activeWorkspaceFolder = activeDocumentUri ? workspace.getWorkspaceFolder(activeDocumentUri) : undefined
    const workspaceFolder = activeWorkspaceFolder ?? workspace.workspaceFolders?.[0]

    return workspaceFolder ? Uri.joinPath(workspaceFolder.uri, '.thousandeyes-recorder', 'drafts') : getPrivateDraftRoot()
  }

  function getDraftRoots(): Uri[] {
    return [...(workspace.workspaceFolders ?? []).map(folder => Uri.joinPath(folder.uri, '.thousandeyes-recorder', 'drafts')), getPrivateDraftRoot()]
  }

  function getPrivateDraftRoot(): Uri {
    return Uri.joinPath(args.context.storageUri ?? args.context.globalStorageUri, 'recording-drafts')
  }

  async function discardStagingDirectory(): Promise<void> {
    const currentStagingDirectory = stagingDirectory

    stagingDirectory = undefined
    if (currentStagingDirectory) {
      await workspace.fs.delete(currentStagingDirectory, { recursive: true, useTrash: false })
    }
  }
}

function getDraftDirectoryName(): string {
  const timestamp = new Date()
    .toISOString()
    .replaceAll(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
  return `recording-${timestamp}-${randomUUID().slice(0, 8)}.recording`
}

function isDraftDocumentInRoot(documentUri: Uri, root: Uri): boolean {
  if (documentUri.scheme !== root.scheme || documentUri.authority !== root.authority) {
    return false
  }

  const rootPath = root.path.endsWith('/') ? root.path : `${root.path}/`
  const relativePath = documentUri.path.startsWith(rootPath) ? documentUri.path.slice(rootPath.length) : undefined
  return relativePath !== undefined && /^[^/]+\.recording\/recording\.json$/.test(relativePath)
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
