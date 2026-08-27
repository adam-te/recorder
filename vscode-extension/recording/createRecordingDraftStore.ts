import { randomUUID } from 'node:crypto'
import { Uri, workspace, type ExtensionContext } from 'vscode'

import type { Recording, RecordingArtifact } from '@te/recorder-core'
import { tryTo } from '@te/recorder-utils'

import { createWorkspaceRecordingArtifactStore, getRecordingDocumentUri } from './createWorkspaceRecordingArtifactStore.ts'

export { createRecordingDraftStore }
export type { RecordingDraftStore }

function createRecordingDraftStore(args: CreateRecordingDraftStoreArgs): RecordingDraftStore {
  return { commit, discard, isDraft, load, stage }

  async function stage(artifact: RecordingArtifact, workspaceUri?: Uri): Promise<Uri> {
    const draftDirectory = Uri.joinPath(workspaceUri ? Uri.joinPath(workspaceUri, '.thousandeyes-recorder', 'drafts') : getPrivateDraftRoot(), getDraftDirectoryName())

    return await tryTo(
      async () => {
        await createWorkspaceRecordingArtifactStore(draftDirectory).save(artifact)
        return getRecordingDocumentUri(draftDirectory)
      },
      async error => {
        await cleanupDirectory(draftDirectory)
        throw error
      },
    )
  }

  function isDraft(documentUri: Uri): boolean {
    return getDraftRoots().some(root => isDraftDocumentInRoot(documentUri, root))
  }

  async function load(documentUri: Uri): Promise<Recording> {
    assertDraft(documentUri)
    return createWorkspaceRecordingArtifactStore(getRecordingDirectory(documentUri)).load()
  }

  async function discard(documentUri: Uri): Promise<boolean> {
    if (!isDraft(documentUri)) return false

    await workspace.fs.delete(getRecordingDirectory(documentUri), { recursive: true, useTrash: false })
    return true
  }

  async function commit(documentUri: Uri, destination: Uri): Promise<Uri> {
    assertDraft(documentUri)
    const draftDirectory = getRecordingDirectory(documentUri)
    const pendingDirectory = destination.with({ path: `${destination.path}.pending-${randomUUID()}` })

    await tryTo(
      async () => {
        const draftStore = createWorkspaceRecordingArtifactStore(draftDirectory)
        await createWorkspaceRecordingArtifactStore(pendingDirectory).save({ recording: await draftStore.load(), readSnapshot: draftStore.loadSnapshot })
        await workspace.fs.rename(pendingDirectory, destination, { overwrite: false })
        await workspace.fs.delete(draftDirectory, { recursive: true, useTrash: false })
      },
      async error => {
        await cleanupDirectory(pendingDirectory)
        throw error
      },
    )

    return getRecordingDocumentUri(destination)
  }

  function assertDraft(documentUri: Uri): void {
    if (isDraft(documentUri)) return
    throw new Error('This recording preview is no longer available.')
  }

  function getDraftRoots(): Uri[] {
    return [...(workspace.workspaceFolders ?? []).map(folder => Uri.joinPath(folder.uri, '.thousandeyes-recorder', 'drafts')), getPrivateDraftRoot()]
  }

  function getPrivateDraftRoot(): Uri {
    return Uri.joinPath(args.context.storageUri ?? args.context.globalStorageUri, 'recording-drafts')
  }
}

function getRecordingDirectory(documentUri: Uri): Uri {
  return Uri.joinPath(documentUri, '..')
}

function getDraftDirectoryName(): string {
  return `recording-${new Date()
    .toISOString()
    .replaceAll(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')}-${randomUUID().slice(0, 8)}.recording`
}

function isDraftDocumentInRoot(documentUri: Uri, root: Uri): boolean {
  if (documentUri.scheme !== root.scheme || documentUri.authority !== root.authority) return false

  const rootPath = root.path.endsWith('/') ? root.path : `${root.path}/`
  const relativePath = documentUri.path.startsWith(rootPath) ? documentUri.path.slice(rootPath.length) : undefined
  return Boolean(relativePath && /^[^/]+\.recording\/recording\.json$/.test(relativePath))
}

async function cleanupDirectory(directory: Uri): Promise<void> {
  await workspace.fs.delete(directory, { recursive: true, useTrash: false }).then(undefined, () => undefined)
}

interface CreateRecordingDraftStoreArgs {
  context: ExtensionContext
}

interface RecordingDraftStore {
  commit: (documentUri: Uri, destination: Uri) => Promise<Uri>
  discard: (documentUri: Uri) => Promise<boolean>
  isDraft: (documentUri: Uri) => boolean
  load: (documentUri: Uri) => Promise<Recording>
  stage: (artifact: RecordingArtifact, workspaceUri?: Uri) => Promise<Uri>
}
