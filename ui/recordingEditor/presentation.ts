import type { RecordedAction, RecordedLocator, RecordedValue } from '@te/recorder-core'
import { matchBy, tryTo } from '@te/recorder-utils'

export { actionKindLabel, actionProperties, displayUrl, formatDate, summarizeAction }

function summarizeAction(action: RecordedAction): string {
  const target = locatorTarget('locatorCandidates' in action ? action.locatorCandidates[0] : undefined)
  return matchBy(action, 'kind', {
    'assert-visible': () => `Verify ${target} is visible`,
    check: current => `${current.checked ? 'Check' : 'Uncheck'} ${target}`,
    click: () => `Click ${target}`,
    fill: () => `Fill ${target}`,
    'go-back': () => 'Go back',
    'go-forward': () => 'Go forward',
    goto: current => `Navigate to ${displayUrl(current.url)}`,
    hover: () => `Hover over ${target}`,
    press: current => `Press ${[...(current.modifiers ?? []), current.key].join('+')} on ${target}`,
    reload: () => 'Reload the page',
    select: current => `Select ${current.options.map(value => `“${value}”`).join(', ')} in ${target}`,
    'set-input-files': current => `Choose ${current.files.length} file${current.files.length === 1 ? '' : 's'} in ${target}`,
  })
}

function locatorTarget(locator: RecordedLocator | undefined): string {
  if (!locator) return 'element'
  if (locator.kind === 'css') return locator.value
  if (locator.kind === 'test-id') return `test ID “${locator.value}”`

  const step = locator.steps.at(-1)
  if (!step) return 'element'
  if (step.method === 'role') return step.name ? `${step.role} “${step.name}”` : step.role
  return `“${step.text}”`
}

function actionProperties(action: RecordedAction): [string, string][] {
  const properties: [string, string][] = []
  if (action.kind === 'fill') properties.push(['Value', formatValue(action.value)])
  if (action.kind === 'click' && action.button) properties.push(['Button', action.button])
  if (action.kind === 'click' && action.clickCount) properties.push(['Click count', String(action.clickCount)])
  if ('modifiers' in action && action.modifiers?.length) properties.push(['Modifiers', action.modifiers.join(' + ')])
  if ('position' in action && action.position) properties.push(['Position', `${action.position.x}, ${action.position.y}`])
  if (action.kind === 'select') properties.push(['Options', action.options.join(', ')])
  if (action.kind === 'set-input-files') properties.push(['Files', action.files.join(', ')])
  return properties
}

function formatValue(value: RecordedValue): string {
  return value.kind === 'secret' ? `Secret: ${value.name}` : value.value
}

function actionKindLabel(kind: RecordedAction['kind']): string {
  return kind.replaceAll('-', ' ')
}

function displayUrl(value: string): string {
  return tryTo(
    () => {
      const url = new URL(value)
      return `${url.host}${url.pathname === '/' ? '' : url.pathname}`
    },
    () => value,
  )
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
