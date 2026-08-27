import { runRecorderCli } from '#cli/runRecorderCli/index.ts'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

import { createRecording, serializeRecording, type RecordedAriaSnapshot, type Recording } from '@te/recorder-core'

import { useTemporaryDirectories } from './support/temporaryDirectories.ts'

describe('runRecorderCli', () => {
  const temporaryDirectories = useTemporaryDirectories()

  test('saves a CLI recording and opens it in the editor', async () => {
    const workingDirectory = await temporaryDirectories.create()
    await mkdir(join(workingDirectory, 'example.recording'))
    const recording: Recording = {
      ...createRecording({ startUrl: 'https://example.com', title: 'Example recording' }),
      actions: [
        { kind: 'goto', pageUrl: 'about:blank', url: 'https://example.com' },
        { kind: 'click', locatorCandidates: [{ kind: 'aria', steps: [{ method: 'role', name: 'Save', role: 'button' }] }], pageUrl: 'https://example.com' },
      ],
    }
    const ariaSnapshot: RecordedAriaSnapshot = { children: [{ name: 'Save', props: {}, ref: 'e1', role: 'button', target: true }], name: '', props: {}, role: 'fragment' }
    const openedDirectories: string[] = []
    const output: string[] = []
    let recordedStartUrl: string | undefined
    const exitCode = await runRecorderCli({
      argv: ['record', 'https://example.com'],
      recorder: {
        dispose: async () => undefined,
        play: async () => undefined,
        start: async args => {
          recordedStartUrl = args.startUrl
          await args.onSnapshotCaptured?.({ actionIndex: 1, ariaSnapshot })
          await args.onStopRequested?.()
        },
        stop: async () => recording,
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
              resolve()
            },
            { once: true },
          )
        }),
      workingDirectory,
    })
    const directoryPath = join(workingDirectory, 'example-2.recording')

    expect(exitCode).toBe(0)
    expect(recordedStartUrl).toBe('https://example.com')
    expect(openedDirectories).toEqual([directoryPath])
    expect(JSON.parse(await readFile(join(directoryPath, 'recording.json'), 'utf8'))).toEqual(JSON.parse(serializeRecording(recording)))
    expect(JSON.parse(await readFile(join(directoryPath, 'snapshots', '0001.aria.json'), 'utf8'))).toEqual(ariaSnapshot)
    expect(output.join('')).toContain(`Saved recording to ${directoryPath}.`)
  })
})
