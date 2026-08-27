import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { createRecordingArtifactStore, type RecordingArtifactStore } from '@te/recorder-core'

export { createFileRecordingArtifactStore }

function createFileRecordingArtifactStore(directoryPath: string): RecordingArtifactStore {
  return createRecordingArtifactStore({
    read: relativePath => readFile(join(directoryPath, relativePath), 'utf8'),
    write: async (relativePath, contents) => {
      const destination = join(directoryPath, relativePath)
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, contents, 'utf8')
    },
  })
}
