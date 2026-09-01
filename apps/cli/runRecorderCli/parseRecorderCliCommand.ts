export { parseRecorderCliCommand }
export type { RecorderCliCommand }

function parseRecorderCliCommand(argv: readonly string[]): RecorderCliCommand {
  const [commandName, ...commandArguments] = argv

  if (!commandName || ['help', '--help', '-h'].includes(commandName)) {
    assertArgumentCount(commandArguments, 0, 'te help')
    return { kind: 'help' }
  }

  if (commandName === 'record') {
    assertArgumentCountBetween(commandArguments, 1, 2, 'te record <url> [recording-directory]')
    return { directoryPath: commandArguments[1], kind: 'record', url: commandArguments[0] }
  }

  if (commandName === 'play') {
    assertArgumentCount(commandArguments, 1, 'te play <directory>')
    return { directoryPath: commandArguments[0], kind: 'play' }
  }

  if (commandName === 'ui') {
    assertArgumentCount(commandArguments, 1, 'te ui <directory>')
    return { directoryPath: commandArguments[0], kind: 'ui' }
  }

  throw new Error(`Unknown command "${commandName}". Run "te help" for usage.`)
}

function assertArgumentCount(positionals: readonly string[], expectedCount: number, usage: string): void {
  if (positionals.length !== expectedCount) {
    throw new Error(`Usage: ${usage}`)
  }
}

function assertArgumentCountBetween(positionals: readonly string[], minimumCount: number, maximumCount: number, usage: string): void {
  if (positionals.length < minimumCount || positionals.length > maximumCount) {
    throw new Error(`Usage: ${usage}`)
  }
}

type RecorderCliCommand = { directoryPath: string; kind: 'play' } | { directoryPath: string; kind: 'ui' } | { directoryPath?: string; kind: 'record'; url: string } | { kind: 'help' }
