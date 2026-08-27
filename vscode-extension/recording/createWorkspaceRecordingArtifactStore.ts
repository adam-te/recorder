import { Uri, workspace } from 'vscode'

import { createRecordingArtifactStore, RECORDING_DOCUMENT_PATH, type RecordingArtifactStore } from '@te/recorder-core'

export { createWorkspaceRecordingArtifactStore, getRecordingDocumentUri }

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function createWorkspaceRecordingArtifactStore(directory: Uri): RecordingArtifactStore {
  return createRecordingArtifactStore({
    read: async relativePath => decoder.decode(await workspace.fs.readFile(resolveArtifactUri(directory, relativePath))),
    write: async (relativePath, contents) => {
      const destination = resolveArtifactUri(directory, relativePath)
      const temporary = destination.with({ path: `${destination.path}.pending` })

      await workspace.fs.createDirectory(Uri.joinPath(destination, '..'))
      await workspace.fs.writeFile(temporary, encoder.encode(contents))
      await workspace.fs.rename(temporary, destination, { overwrite: true })
    },
  })
}

function getRecordingDocumentUri(directory: Uri): Uri {
  return resolveArtifactUri(directory, RECORDING_DOCUMENT_PATH)
}

function resolveArtifactUri(directory: Uri, relativePath: string): Uri {
  return Uri.joinPath(directory, ...relativePath.split('/'))
}
