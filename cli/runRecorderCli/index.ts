import { randomUUID } from 'node:crypto'
import { access, rename, rm } from 'node:fs/promises'
import { isIP } from 'node:net'
import { basename, dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'

import type { RecordingArtifact } from '@te/recorder-core'
import { createRecorder, type Recorder } from '@te/recorder-runtime'
import { matchBy, tryTo } from '@te/recorder-utils'

import { createFileRecordingArtifactStore } from '../recording/createFileRecordingArtifactStore.ts'
import { runRecordingEditor, type RunRecordingEditorArgs } from '../ui/runRecordingEditor.ts'
import { parseRecorderCliCommand, type RecorderCliCommand } from './parseRecorderCliCommand.ts'

export { runRecorderCli }
export { resolveRecordingDirectoryPath }
export type { RunRecorderCliArgs }

const HELP = `Usage: te <command>

Commands:
  record <url> [recording-directory]  Record, save, and open a browser transaction
  play <directory>                    Play a recorded browser transaction
  ui <directory>                      Open a recording in the standalone editor
  help                                Show this help
`

async function runRecorderCli(args: RunRecorderCliArgs): Promise<number> {
  const recorder = args.recorder ?? createRecorder()
  const stderr = args.stderr ?? process.stderr
  const stdout = args.stdout ?? process.stdout

  return await tryTo(
    async () => {
      await executeCommand({ args, command: parseRecorderCliCommand(args.argv), recorder, stdout })

      return 0
    },
    async error => {
      stderr.write(`te: ${error.message}\n`)

      return 1
    },
    () => recorder.dispose(),
  )
}

async function executeCommand(args: ExecuteCommandArgs): Promise<void> {
  await matchBy(args.command, 'kind', {
    help: async () => {
      await args.stdout.write(HELP)
    },
    play: async command => {
      const recording = await createFileRecordingArtifactStore(command.directoryPath).load()

      await args.recorder.play({ recording })
      await args.stdout.write(`Played ${recording.actions.length} recorded actions.\n`)
    },
    ui: async command => {
      await (args.args.runRecordingEditor ?? runRecordingEditor)({ directoryPath: command.directoryPath, onPlay: recording => args.recorder.play({ recording }), stdout: args.stdout })
    },
    record: async command => {
      const directoryPath = await resolveRecordingDirectoryPath({
        directoryPath: command.directoryPath,
        url: command.url,
        workingDirectory: args.args.workingDirectory ?? process.cwd(),
      })
      const stopRequest = createRecordingStopRequest()

      await args.stdout.write(`Recording to ${directoryPath}.\n`)
      await args.recorder.start({
        onStopRequested: stopRequest.request,
        startUrl: command.url,
      })
      await args.stdout.write('Recording started. Press Enter or click Stop recording in the browser to stop and save.\n')
      await stopRequest.wait(args.args.waitForStop ?? waitForEnter)

      const artifact = await args.recorder.stop()
      if (!artifact) {
        throw new Error('The recording stopped without producing a recording.')
      }

      await writeRecordingDirectory({ artifact, directoryPath })
      await args.stdout.write(`Saved recording to ${directoryPath}.\n`)
      await (args.args.runRecordingEditor ?? runRecordingEditor)({ directoryPath, onPlay: recordingToPlay => args.recorder.play({ recording: recordingToPlay }), stdout: args.stdout })
    },
  })
}

function createRecordingStopRequest(): RecordingStopRequest {
  const abortController = new AbortController()
  let rejectRequest: (error: unknown) => void
  let requestPending = false
  let resolveRequest: () => void
  const requested = new Promise<void>((resolve, reject) => {
    rejectRequest = reject
    resolveRequest = resolve
  })

  return { request, wait }

  function request(): void {
    if (requestPending) {
      return
    }

    requestPending = true
    setImmediate(resolveRequest)
  }

  async function wait(waitForTerminalStop: (signal: AbortSignal) => Promise<void>): Promise<void> {
    const terminalStop = waitForTerminalStop(abortController.signal).then(request, error => {
      if (!abortController.signal.aborted) {
        rejectRequest(error)
      }
    })

    await tryTo(
      () => requested,
      undefined,
      async () => {
        abortController.abort()
        await terminalStop
      },
    )
  }
}

async function resolveRecordingDirectoryPath(args: { directoryPath?: string; url: string; workingDirectory: string }): Promise<string> {
  if (args.directoryPath) {
    if (await pathExists(args.directoryPath)) {
      throw new Error(`Recording directory already exists: ${args.directoryPath}`)
    }

    return args.directoryPath
  }

  const stem = getRecordingNameStem(args.url)
  let suffix = 1

  while (true) {
    const directoryPath = resolve(args.workingDirectory, `${stem}${suffix === 1 ? '' : `-${suffix}`}.recording`)
    if (!(await pathExists(directoryPath))) {
      return directoryPath
    }

    suffix += 1
  }
}

function getRecordingNameStem(url: string): string {
  const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '').replace(/^www\./i, '')

  return (
    (isIP(hostname) ? hostname : (hostname.split('.')[0] ?? hostname))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'recording'
  )
}

async function pathExists(path: string): Promise<boolean> {
  return await tryTo(
    async () => {
      await access(path)
      return true
    },
    error => {
      if ('code' in error && error.code === 'ENOENT') return false
      throw error
    },
  )
}

async function writeRecordingDirectory(args: { artifact: RecordingArtifact; directoryPath: string }): Promise<void> {
  const pendingDirectory = join(dirname(args.directoryPath), `.${basename(args.directoryPath)}.pending-${randomUUID()}`)

  await tryTo(
    async () => {
      await createFileRecordingArtifactStore(pendingDirectory).save(args.artifact)

      await rename(pendingDirectory, args.directoryPath)
    },
    async error => {
      await rm(pendingDirectory, { force: true, recursive: true })
      throw error
    },
  )
}

async function waitForEnter(signal: AbortSignal): Promise<void> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout })

  await tryTo(
    () => prompt.question('', { signal }),
    undefined,
    () => prompt.close(),
  )
}

interface RecordingStopRequest {
  request: () => void
  wait: (waitForTerminalStop: (signal: AbortSignal) => Promise<void>) => Promise<void>
}

interface ExecuteCommandArgs {
  args: RunRecorderCliArgs
  command: RecorderCliCommand
  recorder: Recorder
  stdout: CliWriter
}

interface RunRecorderCliArgs {
  argv: readonly string[]
  recorder?: Recorder
  runRecordingEditor?: (args: RunRecordingEditorArgs) => Promise<void>
  stderr?: CliWriter
  stdout?: CliWriter
  waitForStop?: (signal: AbortSignal) => Promise<void>
  workingDirectory?: string
}

interface CliWriter {
  write: (value: string) => Promise<unknown> | unknown
}
