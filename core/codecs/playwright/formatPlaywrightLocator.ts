import type { RecordedLocator } from '#core/recording/recordingSchema.ts'

import { quoteTypeScriptString } from './quoteTypeScriptString.ts'

export { formatPlaywrightLocator }
export type { FormatPlaywrightLocatorOptions }

function formatPlaywrightLocator(locator: RecordedLocator, { includePage = true }: FormatPlaywrightLocatorOptions = {}): string {
  let source = includePage ? 'page' : ''

  for (const frameSelector of locator.framePath ?? []) {
    source = includePage ? appendCall(source, `locator(${quoteTypeScriptString(frameSelector)}).contentFrame()`) : appendCall(source, `frameLocator(${quoteTypeScriptString(frameSelector)})`)
  }

  if (locator.kind !== 'aria') {
    const method = locator.kind === 'css' ? 'locator' : 'getByTestId'

    return appendCall(source, `${method}(${quoteTypeScriptString(locator.value)})`)
  }

  for (const step of locator.steps) {
    if (step.method !== 'role') {
      const stepOptions = step.exact === undefined ? '' : `, { exact: ${step.exact} }`
      const method = { alt: 'getByAltText', label: 'getByLabel', placeholder: 'getByPlaceholder', text: 'getByText', title: 'getByTitle' }[step.method]

      source = appendCall(source, `${method}(${quoteTypeScriptString(step.text)}${stepOptions})`)
      continue
    }

    const stepOptions = [...(step.name ? [`name: ${quoteTypeScriptString(step.name)}`] : []), ...(step.exact === undefined ? [] : [`exact: ${step.exact}`])]
    source = appendCall(source, `getByRole(${quoteTypeScriptString(step.role)}${stepOptions.length ? `, { ${stepOptions.join(', ')} }` : ''})`)
  }

  return source
}

function appendCall(receiver: string, call: string): string {
  return receiver ? `${receiver}.${call}` : call
}

interface FormatPlaywrightLocatorOptions {
  includePage?: boolean
}
