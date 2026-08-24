import { resolveRecordingDirectoryPath } from '#recorder-cli/runRecorderCli/index.ts'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

import { useTemporaryDirectories } from './support/temporaryDirectories.ts'

describe('resolveRecordingDirectoryPath', () => {
  const temporaryDirectories = useTemporaryDirectories()

  test('chooses an available hostname-based recording directory', async () => {
    const workingDirectory = await temporaryDirectories.create()

    expect(await resolveRecordingDirectoryPath({ url: 'https://www.example.com/path', workingDirectory })).toBe(join(workingDirectory, 'example.recording'))
    await mkdir(join(workingDirectory, 'example.recording'))
    expect(await resolveRecordingDirectoryPath({ url: 'https://example.com', workingDirectory })).toBe(join(workingDirectory, 'example-2.recording'))
  })
})
