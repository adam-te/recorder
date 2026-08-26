import { recordingEditorViewType } from '#vscode-extension/recording/createRecordingEditorProvider.ts'
import { randomUUID } from 'node:crypto'
import { commands, Uri, window, workspace, type ExtensionContext } from 'vscode'

import { getRecordingSnapshotFileName, parseRecording, parseRecordingSnapshot, serializeRecording, serializeRecordingSnapshot, type RecordedAriaSnapshot, type Recording } from '@te/recorder-core'
import { createRecorder } from '@te/recorder-runtime'
import { tryTo } from '@te/recorder-utils'

export { createRecorderController }
export type { RecorderController }

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function createRecorderController(args: CreateRecorderControllerArgs): RecorderController {
  const recorder = createRecorder()
  let stagingDirectory: Uri | undefined

  return { discardPending, dispose, isPending, play, savePending, start, stop }

  async function start(startUrl: string): Promise<void> {
    if (stagingDirectory) {
      throw new Error('A recording is already in progress.')
    }

    stagingDirectory = Uri.joinPath(getDraftRoot(), getDraftDirectoryName())
    await workspace.fs.createDirectory(Uri.joinPath(stagingDirectory, 'snapshots'))

    await tryTo(
      () => recorder.start({ onSnapshotCaptured: stageSnapshot, onStopRequested: args.onStopRequested, startUrl }),
      async error => {
        await discardStagingDirectory()
        throw error
      },
    )
  }

  async function stop(): Promise<void> {
    const recording = await recorder.stop()

    if (!recording) {
      await discardStagingDirectory()
      return
    }

    await openPreview(recording)
  }

  async function play(recording?: Recording): Promise<void> {
    if (!recording) {
      const editor = window.activeTextEditor
      if (!editor || editor.document.uri.path.split('/').at(-1) !== 'recording.json') {
        throw new Error('Open a recording.json file before starting playback.')
      }

      recording = parseRecording(JSON.parse(editor.document.getText()))
    }

    await recorder.play({ recording })
    await window.showInformationMessage(`Played ${recording.actions.length} recorded actions.`)
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

    return promptToSave({ draftDirectory: Uri.joinPath(documentUri, '..'), recording: parseRecording(JSON.parse(decoder.decode(await workspace.fs.readFile(documentUri)))) })
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

    const destination = Uri.joinPath(stagingDirectory, 'snapshots', getRecordingSnapshotFileName(args.actionIndex))
    const temporary = destination.with({ path: `${destination.path}.pending` })

    await workspace.fs.writeFile(temporary, encoder.encode(serializeRecordingSnapshot(args.ariaSnapshot)))
    await workspace.fs.rename(temporary, destination, { overwrite: true })
  }

  async function openPreview(recording: Recording): Promise<void> {
    if (!stagingDirectory) {
      throw new Error('Cannot preview a recording without staged files.')
    }

    const destination = Uri.joinPath(stagingDirectory, 'recording.json')
    const temporary = destination.with({ path: `${destination.path}.pending` })
    await workspace.fs.writeFile(temporary, encoder.encode(serializeRecording(recording)))
    await workspace.fs.rename(temporary, destination, { overwrite: true })
    stagingDirectory = undefined
    await commands.executeCommand('vscode.openWith', destination, recordingEditorViewType)
  }

  async function promptToSave(args: { draftDirectory: Uri; recording: Recording }): Promise<Uri | undefined> {
    if (!isPending(Uri.joinPath(args.draftDirectory, 'recording.json'))) return undefined

    const destination = await window.showSaveDialog({ defaultUri: defaultRecordingUri(args.recording, args.draftDirectory), saveLabel: 'Save Recording' })
    if (!destination) return undefined

    const recordingDirectory = destination.path.endsWith('.recording') ? destination : destination.with({ path: `${destination.path}.recording` })
    return await tryTo(
      async () => {
        await commitRecording({ destination: recordingDirectory, recording: args.recording, stagingDirectory: args.draftDirectory })
        await workspace.fs.delete(args.draftDirectory, { recursive: true, useTrash: false })

        await window.showInformationMessage(`Saved recording to ${recordingDirectory.fsPath}.`)
        return Uri.joinPath(recordingDirectory, 'recording.json')
      },
      async error => ((await window.showErrorMessage(`Could not save recording: ${error.message}`, 'Choose Another Location', 'Cancel')) === 'Choose Another Location' ? promptToSave(args) : undefined),
    )
  }

  function defaultRecordingUri(recording: Recording, draftDirectory: Uri): Uri | undefined {
    const workspaceFolder = workspace.getWorkspaceFolder(draftDirectory) ?? workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      return undefined
    }

    const name = recording.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    return Uri.joinPath(workspaceFolder.uri, `${name || 'recording'}.recording`)
  }

  function getDraftRoot(): Uri {
    const activeDocumentUri = window.activeTextEditor?.document.uri
    const workspaceFolder = (activeDocumentUri ? workspace.getWorkspaceFolder(activeDocumentUri) : undefined) ?? workspace.workspaceFolders?.[0]

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
    if (!currentStagingDirectory) return
    await workspace.fs.delete(currentStagingDirectory, { recursive: true, useTrash: false })
  }
}

function getDraftDirectoryName(): string {
  return `recording-${new Date()
    .toISOString()
    .replaceAll(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')}-${randomUUID().slice(0, 8)}.recording`
}

function isDraftDocumentInRoot(documentUri: Uri, root: Uri): boolean {
  if (documentUri.scheme !== root.scheme || documentUri.authority !== root.authority) {
    return false
  }

  const rootPath = root.path.endsWith('/') ? root.path : `${root.path}/`
  const relativePath = documentUri.path.startsWith(rootPath) ? documentUri.path.slice(rootPath.length) : undefined
  return Boolean(relativePath && /^[^/]+\.recording\/recording\.json$/.test(relativePath))
}

async function commitRecording(args: { destination: Uri; recording: Recording; stagingDirectory: Uri }): Promise<void> {
  const pendingDirectory = args.destination.with({ path: `${args.destination.path}.pending-${randomUUID()}` })

  await tryTo(
    async () => {
      const pendingSnapshotsDirectory = Uri.joinPath(pendingDirectory, 'snapshots')
      await workspace.fs.createDirectory(pendingSnapshotsDirectory)
      await workspace.fs.writeFile(Uri.joinPath(pendingDirectory, 'recording.json'), encoder.encode(serializeRecording(args.recording)))

      const stagedSnapshotsDirectory = Uri.joinPath(args.stagingDirectory, 'snapshots')
      for (const [actionIndex, action] of args.recording.actions.entries()) {
        if (!('locatorCandidates' in action)) {
          continue
        }

        const name = getRecordingSnapshotFileName(actionIndex)
        const contents = await workspace.fs.readFile(Uri.joinPath(stagedSnapshotsDirectory, name))
        parseRecordingSnapshot(JSON.parse(decoder.decode(contents)))
        await workspace.fs.writeFile(Uri.joinPath(pendingSnapshotsDirectory, name), contents)
      }

      parseRecording(JSON.parse(decoder.decode(await workspace.fs.readFile(Uri.joinPath(pendingDirectory, 'recording.json')))))
      await workspace.fs.rename(pendingDirectory, args.destination, { overwrite: false })
    },
    async error => {
      await workspace.fs.delete(pendingDirectory, { recursive: true, useTrash: false }).then(undefined, () => undefined)
      throw error
    },
  )
}

interface RecorderController {
  discardPending: (documentUri: Uri) => Promise<boolean>
  dispose: () => Promise<void>
  isPending: (documentUri: Uri) => boolean
  play: (recording?: Recording) => Promise<void>
  savePending: (documentUri: Uri) => Promise<Uri | undefined>
  start: (startUrl: string) => Promise<void>
  stop: () => Promise<void>
}

interface CreateRecorderControllerArgs {
  context: ExtensionContext
  onStopRequested?: () => Promise<void> | void
}
