import { recordingSchema, type RecordedAction, type RecordedValue, type Recording } from '#core/recording/recordingSchema.ts'

import { matchBy } from '@te/recorder-utils'

import { formatPlaywrightLocator as locator } from './formatPlaywrightLocator.ts'
import { quoteTypeScriptString as quote } from './quoteTypeScriptString.ts'

export { generatePlaywrightScript }

function generatePlaywrightScript(value: Recording): string {
  const recording = recordingSchema.parse(value)
  return `import { test } from 'playwright/test'

test(${quote(recording.title)}, async ({ page }) => {
${recording.actions.map(action => `  ${renderAction(action)}`).join('\n')}
})${helpers(recording.actions)}
`
}

function helpers(actions: RecordedAction[]): string {
  if (!actions.some(action => action.kind === 'fill' && action.value.kind === 'secret')) return ''

  return `

function requiredSecret(name: string): string {
  const value = process.env[name]

  if (value === undefined) {
    throw new Error(\`Missing required secret: \${name}\`)
  }

  return value
}`
}

function renderAction(action: RecordedAction): string {
  return matchBy(action, 'kind', {
    'assert-visible': current => `await ${target(current)}.waitFor({ state: "visible" })`,
    check: current => `await ${target(current)}.${current.checked ? 'check' : 'uncheck'}()`,
    click: current => `await ${target(current)}.click(${clickOptions(current)})`,
    fill: current => `await ${target(current)}.fill(${value(current.value)})`,
    'go-back': () => 'await page.goBack()',
    'go-forward': () => 'await page.goForward()',
    goto: current => `await page.goto(${quote(current.url)})`,
    hover: current => `await ${target(current)}.hover(${positionOptions(current.position)})`,
    press: current => `await ${target(current)}.press(${quote([...(current.modifiers ?? []), current.key].join('+'))})`,
    reload: () => 'await page.reload()',
    select: current => `await ${target(current)}.selectOption(${array(current.options)})`,
    'set-input-files': current => `await ${target(current)}.setInputFiles(${array(current.files)})`,
  })
}

function value(recordedValue: RecordedValue): string {
  return matchBy(recordedValue, 'kind', {
    'plain-text': current => quote(current.value),
    secret: current => `requiredSecret(${quote(current.name)})`,
  })
}

function target(action: LocatedAction): string {
  return locator(action.locatorCandidates[0])
}

function clickOptions(action: ClickAction): string {
  return options({
    button: optional(action.button, quote),
    clickCount: action.clickCount,
    modifiers: optional(action.modifiers, array),
    position: optional(action.position, point),
  })
}

function positionOptions(position: Position | undefined): string {
  return options({ position: optional(position, point) })
}

function options(values: Record<string, string | number | undefined>): string {
  const properties = Object.entries(values).flatMap(([name, value]) => (value ? `${name}: ${value}` : []))

  return properties.length ? `{ ${properties.join(', ')} }` : ''
}

const point = ({ x, y }: Position): string => `{ x: ${x}, y: ${y} }`
const array = (values: string[]): string => `[${values.map(quote).join(', ')}]`
const optional = <Value>(value: Value | undefined, render: (value: Value) => string): string | undefined => (value ? render(value) : undefined)

type LocatedAction = Extract<RecordedAction, { locatorCandidates: unknown }>
type ClickAction = Extract<RecordedAction, { kind: 'click' }>
type Position = NonNullable<ClickAction['position']>
