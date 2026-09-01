import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'

export { useTemporaryDirectories }

function useTemporaryDirectories(): TemporaryDirectories {
  const paths: string[] = []

  afterEach(async () => {
    await Promise.all(paths.splice(0).map(path => rm(path, { force: true, recursive: true })))
  })

  return {
    create: async () => {
      const path = await mkdtemp(join(tmpdir(), 'recorder-cli-'))
      paths.push(path)
      return path
    },
  }
}

interface TemporaryDirectories {
  create: () => Promise<string>
}
