import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { createInterface } from 'node:readline/promises'

import { getRecordingSnapshotFileName, parseRecordingDocument, parseRecordingSnapshot, serializeRecordingDocument, serializeRecordingSnapshot, type RecordedAriaSnapshot, type RecordingDocument } from '@te/recorder-core'
import { createRecorder, type Recorder } from '@te/recorder-runtime'
import { matchBy, tryTo } from '@te/recorder-utils'

import { runRecordingEditor } from '../ui/runRecordingEditor.ts'
import { parseRecorderCliCommand, type RecorderCliCommand } from './parseRecorderCliCommand.ts'

export { runRecorderCli }
export type { RunRecorderCliArgs }

const HELP = `Usage: te <command>

Commands:
  record <url> <directory>  Record a browser transaction
  play <directory>          Play a recorded browser transaction
  ui <directory>            Open a recording in the standalone editor
  help                      Show this help
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
      const document = parseRecordingDocument(JSON.parse(await readFile(join(command.directoryPath, 'recording.json'), 'utf8')))

      await args.recorder.play({ document })
      await args.stdout.write(`Played ${document.actions.length} recorded actions.\n`)
    },
    ui: async command => {
      await runRecordingEditor({ directoryPath: command.directoryPath, onPlay: document => args.recorder.play({ document }), stdout: args.stdout })
    },
    record: async command => {
      const snapshots = new Map<number, RecordedAriaSnapshot>()

      await args.recorder.start({
        onSnapshotCaptured: snapshot => {
          snapshots.set(snapshot.actionIndex, snapshot.ariaSnapshot)
        },
        url: command.url,
      })
      await args.stdout.write('Recording started. Press Enter to stop and save.\n')
      await waitForEnter()

      const document = await args.recorder.stop()
      if (!document) {
        throw new Error('The recording stopped without producing a document.')
      }

      await writeRecordingDirectory({ directoryPath: command.directoryPath, document, snapshots })
      await args.stdout.write(`Saved recording to ${command.directoryPath}.\n`)
    },
  })
}

async function writeRecordingDirectory(args: { directoryPath: string; document: RecordingDocument; snapshots: ReadonlyMap<number, RecordedAriaSnapshot> }): Promise<void> {
  const pendingDirectory = join(dirname(args.directoryPath), `.${basename(args.directoryPath)}.pending-${randomUUID()}`)

  try {
    const snapshotsDirectory = join(pendingDirectory, 'snapshots')
    await mkdir(snapshotsDirectory, { recursive: true })
    await writeFile(join(pendingDirectory, 'recording.json'), serializeRecordingDocument(args.document), 'utf8')

    for (const [actionIndex, action] of args.document.actions.entries()) {
      if (!('locatorCandidates' in action)) {
        continue
      }

      const snapshot = args.snapshots.get(actionIndex)
      if (!snapshot) {
        throw new Error(`Missing ARIA snapshot for action ${actionIndex}.`)
      }

      await writeFile(join(snapshotsDirectory, getRecordingSnapshotFileName(actionIndex)), serializeRecordingSnapshot(snapshot), 'utf8')
    }

    parseRecordingDocument(JSON.parse(await readFile(join(pendingDirectory, 'recording.json'), 'utf8')))
    for (const [actionIndex, action] of args.document.actions.entries()) {
      if (!('locatorCandidates' in action)) {
        continue
      }

      parseRecordingSnapshot(JSON.parse(await readFile(join(snapshotsDirectory, getRecordingSnapshotFileName(actionIndex)), 'utf8')))
    }

    await rename(pendingDirectory, args.directoryPath)
  } catch (error) {
    await rm(pendingDirectory, { force: true, recursive: true })
    throw error
  }
}

async function waitForEnter(): Promise<void> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout })

  await tryTo(
    () => prompt.question(''),
    undefined,
    () => prompt.close(),
  )
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
  stderr?: CliWriter
  stdout?: CliWriter
}

interface CliWriter {
  write: (value: string) => Promise<unknown> | unknown
}
