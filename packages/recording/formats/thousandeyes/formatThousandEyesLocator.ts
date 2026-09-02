import type { RecordedLocator } from '#recording/recording/recordingSchema.ts'

import { matchBy } from '@te/recorder-utils'

import { quoteJavaScriptString as quote } from './quoteJavaScriptString.ts'

export { formatThousandEyesLocator }

function formatThousandEyesLocator(locator: RecordedLocator): string {
  return `findElement(${matchBy(locator, 'kind', {
    aria: () => unsupported('ARIA locators'),
    css: current => `By.css(${quote(current.value)})`,
    'test-id': current => `By.css(${quote(formatTestIdSelector(current.value))})`,
  })}${locator.framePath?.length ? `, ${array(locator.framePath)}` : ''})`
}

function formatTestIdSelector(value: string): string {
  return `[data-testid="${Array.from(value, character => escapeCssStringCharacter(character)).join('')}"]`
}

function escapeCssStringCharacter(character: string): string {
  const codePoint = character.codePointAt(0) ?? 0

  if (!codePoint) return unsupported('test ID locators containing a null character')
  if (codePoint <= 0x1f || codePoint === 0x7f) return `\\${codePoint.toString(16)} `
  if (character === '"' || character === '\\') return `\\${character}`

  return character
}

function unsupported(locator: string): never {
  throw new Error(`${locator} are not supported`)
}

function array(values: string[]): string {
  return `[${values.map(quote).join(', ')}]`
}
