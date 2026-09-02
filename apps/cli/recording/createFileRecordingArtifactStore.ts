import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { createRecordingArtifactStore, type RecordingArtifactStore } from '@te/recorder-recording'

export { createFileRecordingArtifactStore }

function createFileRecordingArtifactStore(directoryPath: string): RecordingArtifactStore {
  return createRecordingArtifactStore({
    read: relativePath => readFile(join(directoryPath, relativePath), 'utf8'),
    readBinary: relativePath => readFile(join(directoryPath, relativePath)),
    write: async (relativePath, contents) => {
      const destination = join(directoryPath, relativePath)
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, contents, 'utf8')
    },
    writeBinary: async (relativePath, contents) => {
      const destination = join(directoryPath, relativePath)
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, contents)
    },
  })
}
