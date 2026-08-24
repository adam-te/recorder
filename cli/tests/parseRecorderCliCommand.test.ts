import { parseRecorderCliCommand } from '#recorder-cli/runRecorderCli/parseRecorderCliCommand.ts'
import { describe, expect, test } from 'vitest'

describe('parseRecorderCliCommand', () => {
  test('parses record commands with an optional recording directory', () => {
    expect(parseRecorderCliCommand(['record', 'https://example.com'])).toEqual({ directoryPath: undefined, kind: 'record', url: 'https://example.com' })
    expect(parseRecorderCliCommand(['record', 'https://example.com', 'custom.recording'])).toEqual({ directoryPath: 'custom.recording', kind: 'record', url: 'https://example.com' })
    expect(() => parseRecorderCliCommand(['record'])).toThrow('Usage: te record <url> [recording-directory]')
  })

  test('parses the ui command', () => {
    expect(parseRecorderCliCommand(['ui', 'example.recording'])).toEqual({ directoryPath: 'example.recording', kind: 'ui' })
    expect(() => parseRecorderCliCommand(['ui'])).toThrow('Usage: te ui <directory>')
  })
})
