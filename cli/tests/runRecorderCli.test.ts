import { runRecorderCli } from '#cli/runRecorderCli/index.ts'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

import { createRecordingDocument, serializeRecordingDocument } from '@te/recorder-core'

import { useTemporaryDirectories } from './support/temporaryDirectories.ts'

describe('runRecorderCli', () => {
  const temporaryDirectories = useTemporaryDirectories()

  test('saves a CLI recording and opens it in the editor', async () => {
    const workingDirectory = await temporaryDirectories.create()
    const document = createRecordingDocument({ startUrl: 'https://example.com', title: 'Example recording' })
    const openedDirectories: string[] = []
    const output: string[] = []
    let recordedStartUrl: string | undefined
    let terminalWaitAborted = false
    const exitCode = await runRecorderCli({
      argv: ['record', 'https://example.com'],
      recorder: {
        dispose: async () => undefined,
        play: async () => undefined,
        start: async args => {
          recordedStartUrl = args.startUrl
          await args.onStopRequested?.()
        },
        stop: async () => document,
      },
      runRecordingEditor: async args => {
        openedDirectories.push(args.directoryPath)
      },
      stdout: { write: value => output.push(value) },
      waitForStop: signal =>
        new Promise(resolve => {
          signal.addEventListener(
            'abort',
            () => {
              terminalWaitAborted = true
              resolve()
            },
            { once: true },
          )
        }),
      workingDirectory,
    })
    const directoryPath = join(workingDirectory, 'example.recording')

    expect(exitCode).toBe(0)
    expect(recordedStartUrl).toBe('https://example.com')
    expect(terminalWaitAborted).toBe(true)
    expect(openedDirectories).toEqual([directoryPath])
    expect(JSON.parse(await readFile(join(directoryPath, 'recording.json'), 'utf8'))).toEqual(JSON.parse(serializeRecordingDocument(document)))
    expect(output.join('')).toContain(`Recording to ${directoryPath}.`)
    expect(output.join('')).toContain(`Saved recording to ${directoryPath}.`)
  })
})
