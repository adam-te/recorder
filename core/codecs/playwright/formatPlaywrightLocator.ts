import type { RecordedLocator } from '#core/recording/recordingSchema.ts'

import { matchBy } from '@te/recorder-utils'

import { quoteTypeScriptString } from './quoteTypeScriptString.ts'

export { formatPlaywrightLocator }
export type { FormatPlaywrightLocatorOptions }

function formatPlaywrightLocator(locator: RecordedLocator, { includePage = true }: FormatPlaywrightLocatorOptions = {}): string {
  return [
    includePage ? 'page' : '',
    ...(locator.framePath ?? []).map(selector => formatFrame(selector, includePage)),
    ...matchBy(locator, 'kind', {
      aria: current => current.steps.map(formatAriaStep),
      css: current => [`locator(${quoteTypeScriptString(current.value)})`],
      'test-id': current => [`getByTestId(${quoteTypeScriptString(current.value)})`],
    }),
  ]
    .filter(Boolean)
    .join('.')
}

function formatFrame(selector: string, includePage: boolean): string {
  return includePage ? `locator(${quoteTypeScriptString(selector)}).contentFrame()` : `frameLocator(${quoteTypeScriptString(selector)})`
}

function formatAriaStep(step: AriaStep): string {
  return matchBy(step, 'method', {
    alt: current => formatTextStep('getByAltText', current),
    label: current => formatTextStep('getByLabel', current),
    placeholder: current => formatTextStep('getByPlaceholder', current),
    role: current => `getByRole(${quoteTypeScriptString(current.role)}${formatOptions({ name: current.name ? quoteTypeScriptString(current.name) : undefined, exact: current.exact })})`,
    text: current => formatTextStep('getByText', current),
    title: current => formatTextStep('getByTitle', current),
  })
}

function formatTextStep(method: string, { exact, text }: { exact?: boolean; text: string }): string {
  return `${method}(${quoteTypeScriptString(text)}${formatOptions({ exact })})`
}

function formatOptions(values: Record<string, boolean | string | undefined>): string {
  const properties = Object.entries(values).flatMap(([name, value]) => (value === undefined ? [] : `${name}: ${value}`))

  return properties.length ? `, { ${properties.join(', ')} }` : ''
}

interface FormatPlaywrightLocatorOptions {
  includePage?: boolean
}

type AriaStep = Extract<RecordedLocator, { kind: 'aria' }>['steps'][number]
