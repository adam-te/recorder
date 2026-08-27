import { runRecorderCli } from '#cli/runRecorderCli/index.ts'
import { mkdir, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

import { createRecording, serializeRecording, type RecordedAriaSnapshot, type Recording } from '@te/recorder-core'

import { useTemporaryDirectories } from './support/temporaryDirectories.ts'

describe('runRecorderCli', () => {
  const temporaryDirectories = useTemporaryDirectories()

  test('passes the requested start URL to the recorder', async () => {
    expect((await runCliRecording(await temporaryDirectories.create())).recordedStartUrl).toBe('https://example.com')
  })

  test('uses a collision-safe recording directory', async () => {
    const result = await runCliRecording(await temporaryDirectories.create())

    expect(await readdir(result.workingDirectory)).toContain('example-2.recording')
  })

  test('saves the completed recording', async () => {
    const result = await runCliRecording(await temporaryDirectories.create())

    expect(JSON.parse(await readFile(join(result.directoryPath, 'recording.json'), 'utf8'))).toEqual(JSON.parse(serializeRecording(result.recording)))
  })

  test('saves captured ARIA snapshots', async () => {
    const result = await runCliRecording(await temporaryDirectories.create())

    expect(JSON.parse(await readFile(join(result.directoryPath, 'snapshots', '0001.aria.json'), 'utf8'))).toEqual(result.ariaSnapshot)
  })

  test('opens the saved recording in the editor', async () => {
    const result = await runCliRecording(await temporaryDirectories.create())

    expect(result.openedDirectories).toEqual([result.directoryPath])
  })
})

async function runCliRecording(workingDirectory: string): Promise<CliRecordingResult> {
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
  let recordedStartUrl: string | undefined

  await runRecorderCli({
    argv: ['record', 'https://example.com'],
    recorder: {
      dispose: async () => undefined,
      play: async () => undefined,
      start: async args => {
        recordedStartUrl = args.startUrl
        await args.onStopRequested?.()
      },
      stop: async () => ({ readSnapshot: () => ariaSnapshot, recording }),
    },
    runRecordingEditor: async args => {
      openedDirectories.push(args.directoryPath)
    },
    stdout: { write: () => undefined },
    waitForStop: signal =>
      new Promise(resolve => {
        signal.addEventListener('abort', () => resolve(), { once: true })
      }),
    workingDirectory,
  })

  return { ariaSnapshot, directoryPath: join(workingDirectory, 'example-2.recording'), openedDirectories, recordedStartUrl, recording, workingDirectory }
}

interface CliRecordingResult {
  ariaSnapshot: RecordedAriaSnapshot
  directoryPath: string
  openedDirectories: string[]
  recordedStartUrl: string | undefined
  recording: Recording
  workingDirectory: string
}
