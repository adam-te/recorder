import type { RecordedLocator } from '#core/document/recordingDocumentSchema.ts'

import { quoteTypeScriptString } from './quoteTypeScriptString.ts'

export { formatPlaywrightLocator }
export type { FormatPlaywrightLocatorOptions }

function formatPlaywrightLocator(locator: RecordedLocator, options: FormatPlaywrightLocatorOptions = {}): string {
  const scope = options.scope ?? 'page'
  let source = scope === 'page' ? 'page' : ''

  for (const frameSelector of locator.framePath ?? []) {
    source = scope === 'page' ? appendCall(source, `locator(${quoteTypeScriptString(frameSelector)}).contentFrame()`) : appendCall(source, `frameLocator(${quoteTypeScriptString(frameSelector)})`)
  }

  if (locator.kind === 'css') {
    return appendCall(source, `locator(${quoteTypeScriptString(locator.value)})`)
  }

  for (const step of locator.steps) {
    if (step.method === 'label') {
      const stepOptions = step.exact === undefined ? '' : `, { exact: ${step.exact} }`
      source = appendCall(source, `getByLabel(${quoteTypeScriptString(step.text)}${stepOptions})`)
      continue
    }

    const stepOptions = [...(step.name === undefined ? [] : [`name: ${quoteTypeScriptString(step.name)}`]), ...(step.exact === undefined ? [] : [`exact: ${step.exact}`])]
    source = appendCall(source, `getByRole(${quoteTypeScriptString(step.role)}${stepOptions.length ? `, { ${stepOptions.join(', ')} }` : ''})`)
  }

  return source
}

function appendCall(receiver: string, call: string): string {
  return receiver ? `${receiver}.${call}` : call
}

interface FormatPlaywrightLocatorOptions {
  scope?: 'implicit' | 'page'
}
