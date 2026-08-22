import { readFile, writeFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'

import { parseRecordingDocument, serializeRecordingDocument } from '@te/recorder-core'
import { createRecorder, type Recorder } from '@te/recorder-runtime'
import { matchBy, tryTo } from '@te/recorder-utils'

import { parseRecorderCliCommand, type RecorderCliCommand } from './parseRecorderCliCommand.ts'

export { runRecorderCli }
export type { RunRecorderCliArgs }

const HELP = `Usage: te <command>

Commands:
  record <url> <file>  Record a browser transaction
  play <file>          Play a recorded browser transaction
  help                 Show this help
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
      const document = parseRecordingDocument(JSON.parse(await readFile(command.filePath, 'utf8')))

      await args.recorder.play({ document })
      await args.stdout.write(`Played ${document.actions.length} recorded actions.\n`)
    },
    record: async command => {
      await args.recorder.start({ url: command.url })
      await args.stdout.write('Recording started. Press Enter to stop and save.\n')
      await waitForEnter()

      const document = await args.recorder.stop()
      if (!document) {
        throw new Error('The recording stopped without producing a document.')
      }

      await writeFile(command.filePath, serializeRecordingDocument(document), 'utf8')
      await args.stdout.write(`Saved recording to ${command.filePath}.\n`)
    },
  })
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
