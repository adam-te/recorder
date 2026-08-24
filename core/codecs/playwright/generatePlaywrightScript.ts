import { recordingDocumentSchema, type RecordedAction, type RecordedLocator, type RecordedValue, type RecordingDocument } from '#core/document/recordingDocumentSchema.ts'

export { generatePlaywrightScript }

function generatePlaywrightScript(document: RecordingDocument): string {
  const parsedDocument = recordingDocumentSchema.parse(document)
  const lines = ["import { test } from 'playwright/test'", '', parsedDocument.actions.length ? `test(${quote(parsedDocument.title)}, async ({ page }) => {` : `test(${quote(parsedDocument.title)}, async () => {})`]

  if (parsedDocument.actions.length) {
    lines.push(...parsedDocument.actions.map(action => `  ${renderAction(action)}`), '})')
  }

  if (parsedDocument.actions.some(action => action.kind === 'fill' && action.value.kind === 'secret')) {
    lines.push('', 'function requiredSecret(name: string): string {', '  const value = process.env[name]', '', '  if (value === undefined) {', '    throw new Error(`Missing required secret: ${name}`)', '  }', '', '  return value', '}')
  }

  return `${lines.join('\n')}\n`
}

function renderAction(action: RecordedAction): string {
  switch (action.kind) {
    case 'assert-visible':
      return `await ${renderLocator(action.locatorCandidates[0])}.waitFor({ state: "visible" })`
    case 'check':
      return `await ${renderLocator(action.locatorCandidates[0])}.${action.checked ? 'check' : 'uncheck'}()`
    case 'click': {
      const options = [
        ...(action.button === undefined ? [] : [`button: ${quote(action.button)}`]),
        ...(action.clickCount === undefined ? [] : [`clickCount: ${action.clickCount}`]),
        ...(action.modifiers === undefined ? [] : [`modifiers: ${renderStringArray(action.modifiers)}`]),
        ...(action.position === undefined ? [] : [`position: ${renderPosition(action.position)}`]),
      ]

      return `await ${renderLocator(action.locatorCandidates[0])}.click(${renderOptionalObject(options)})`
    }
    case 'fill':
      return `await ${renderLocator(action.locatorCandidates[0])}.fill(${renderValue(action.value)})`
    case 'go-back':
      return 'await page.goBack()'
    case 'go-forward':
      return 'await page.goForward()'
    case 'goto':
      return `await page.goto(${quote(action.url)})`
    case 'hover':
      return `await ${renderLocator(action.locatorCandidates[0])}.hover(${renderOptionalObject(action.position === undefined ? [] : [`position: ${renderPosition(action.position)}`])})`
    case 'press':
      return `await ${renderLocator(action.locatorCandidates[0])}.press(${quote([...(action.modifiers ?? []), action.key].join('+'))})`
    case 'reload':
      return 'await page.reload()'
    case 'select':
      return `await ${renderLocator(action.locatorCandidates[0])}.selectOption(${renderStringArray(action.options)})`
    case 'set-input-files':
      return `await ${renderLocator(action.locatorCandidates[0])}.setInputFiles(${renderStringArray(action.files)})`
  }

  return assertNever(action)
}

function renderLocator(locator: RecordedLocator): string {
  let source = 'page'

  for (const frameSelector of locator.framePath ?? []) {
    source += `.locator(${quote(frameSelector)}).contentFrame()`
  }

  if (locator.kind === 'css') {
    return `${source}.locator(${quote(locator.value)})`
  }

  for (const step of locator.steps) {
    if (step.method === 'label') {
      const options = step.exact === undefined ? '' : `, { exact: ${step.exact} }`
      source += `.getByLabel(${quote(step.text)}${options})`
      continue
    }

    const options = [...(step.name === undefined ? [] : [`name: ${quote(step.name)}`]), ...(step.exact === undefined ? [] : [`exact: ${step.exact}`])]
    source += `.getByRole(${quote(step.role)}${options.length ? `, { ${options.join(', ')} }` : ''})`
  }

  return source
}

function renderValue(value: RecordedValue): string {
  switch (value.kind) {
    case 'plain-text':
      return quote(value.value)
    case 'secret':
      return `requiredSecret(${quote(value.name)})`
  }

  return assertNever(value)
}

function renderOptionalObject(properties: string[]): string {
  return properties.length ? `{ ${properties.join(', ')} }` : ''
}

function renderPosition(position: { x: number; y: number }): string {
  return `{ x: ${position.x}, y: ${position.y} }`
}

function renderStringArray(values: string[]): string {
  return `[${values.map(quote).join(', ')}]`
}

function quote(value: string): string {
  return JSON.stringify(value).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')
}

function assertNever(value: never): never {
  throw new Error(`Unsupported recorded value: ${JSON.stringify(value)}`)
}
