export { parseRecorderCliCommand }
export type { RecorderCliCommand }

function parseRecorderCliCommand(argv: readonly string[]): RecorderCliCommand {
  const [commandName, ...commandArguments] = argv
  let command: RecorderCliCommand

  if (!commandName || ['help', '--help', '-h'].includes(commandName)) {
    assertArgumentCount(commandArguments, 0, 'te help')
    command = { kind: 'help' }
  } else if (commandName === 'record') {
    assertArgumentCount(commandArguments, 2, 'te record <url> <file>')
    command = { filePath: commandArguments[1], kind: 'record', url: commandArguments[0] }
  } else if (commandName === 'play') {
    assertArgumentCount(commandArguments, 1, 'te play <file>')
    command = { filePath: commandArguments[0], kind: 'play' }
  } else {
    throw new Error(`Unknown command "${commandName}". Run "te help" for usage.`)
  }

  return command
}

function assertArgumentCount(positionals: readonly string[], expectedCount: number, usage: string): void {
  if (positionals.length !== expectedCount) {
    throw new Error(`Usage: ${usage}`)
  }
}

type RecorderCliCommand = { kind: 'help' } | { filePath: string; kind: 'play' } | { filePath: string; kind: 'record'; url: string }
