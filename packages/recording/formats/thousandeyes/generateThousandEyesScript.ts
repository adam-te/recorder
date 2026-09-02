import { recordingSchema, type RecordedAction, type RecordedValue, type Recording } from '#recording/recording/recordingSchema.ts'

import { matchBy, tryTo } from '@te/recorder-utils'

import { formatThousandEyesLocator as locator } from './formatThousandEyesLocator.ts'
import { quoteJavaScriptString as quote } from './quoteJavaScriptString.ts'
import type { ThousandEyesTransactionScript } from './types.ts'

export { generateThousandEyesScript, resolveThousandEyesScreenshotBoundary }

function generateThousandEyesScript(value: Recording): ThousandEyesTransactionScript {
  const recording = recordingSchema.parse(value)

  return {
    language: 'javascript',
    source: `${imports(recording)}runScript();

async function runScript() {
${renderStatements(recording)
  .map(statement => `  ${statement}`)
  .join('\n')}
}${helpers(recording.actions)}
`,
  }
}

function renderStatements(recording: Recording): string[] {
  const screenshots = recording.thousandEyes.screenshots.map(screenshot => ({ at: resolveThousandEyesScreenshotBoundary(screenshot.at, recording) }))

  return Array.from({ length: recording.actions.length + 1 }, (_, boundary) => [
    ...recording.thousandEyes.markers.filter(marker => marker.end === boundary).map(marker => `markers.stop(${quote(marker.name)});`),
    ...screenshots.filter(screenshot => screenshot.at === boundary).map(() => 'await driver.takeScreenshot();'),
    ...recording.thousandEyes.markers.filter(marker => marker.start === boundary).map(marker => `markers.start(${quote(marker.name)});`),
    ...(recording.actions[boundary] ? [renderAction(recording.actions[boundary], boundary)] : []),
  ]).flat()
}

function resolveThousandEyesScreenshotBoundary(requestedBoundary: number, recording: Recording): number {
  let boundary = requestedBoundary

  while (true) {
    const adjacentMarkers = recording.thousandEyes.markers.filter(marker => marker.start <= boundary && boundary < marker.end)
    if (!adjacentMarkers.length) return boundary

    boundary = Math.max(...adjacentMarkers.map(marker => marker.end))
  }
}

function renderAction(action: RecordedAction, actionIndex: number): string {
  return tryTo(
    () =>
      matchBy(action, 'kind', {
        'assert-visible': current => `await driver.wait(until.elementIsVisible(await ${target(current)}));`,
        check: current => `await setChecked(await ${target(current)}, ${current.checked});`,
        click: current => renderClick(current),
        fill: current => `await fill(await ${target(current)}, ${renderValue(current.value)});`,
        'go-back': () => 'await driver.navigate().back();',
        'go-forward': () => 'await driver.navigate().forward();',
        goto: current => `await driver.get(${quote(current.url)});`,
        hover: current => renderHover(current),
        press: current => `await (await ${target(current)}).sendKeys(${renderKey(current)});`,
        reload: () => 'await driver.navigate().refresh();',
        select: () => unsupported('select actions'),
        'set-input-files': () => unsupported('file upload actions'),
      }),
    error => {
      throw new Error(`Cannot export action ${actionIndex} (${action.kind}) to ThousandEyes: ${error.message}.`, { cause: error })
    },
  )
}

function renderClick(action: ClickAction): string {
  if (action.button && action.button !== 'left') return unsupported(`${action.button}-button clicks`)
  if (action.clickCount && action.clickCount !== 1) return unsupported(`clicks with a click count of ${action.clickCount}`)
  if (action.modifiers?.length) return unsupported('clicks with modifiers')
  if (action.position) return unsupported('positioned clicks')

  return `await (await ${target(action)}).click();`
}

function renderHover(action: HoverAction): string {
  if (action.position) return unsupported('positioned hover actions')

  return `await driver.actions().move({ origin: await ${target(action)} }).perform();`
}

function renderKey(action: PressAction): string {
  const key = specialKeys[action.key] ?? (Array.from(action.key).length === 1 ? quote(action.key) : unsupported(`the ${quote(action.key)} key`))
  const keys = [...(action.modifiers ?? []).map(modifier => `Key.${modifier.toUpperCase()}`), key]

  return keys.length > 1 ? `Key.chord(${keys.join(', ')})` : key
}

function renderValue(value: RecordedValue): string {
  return matchBy(value, 'kind', {
    'plain-text': current => quote(current.value),
    secret: current => `credentials.get(${quote(current.name)})`,
  })
}

function target(action: LocatedAction): string {
  return locator(action.locatorCandidates[0])
}

function imports(recording: Recording): string {
  const seleniumImports = ['By', ...(recording.actions.some(action => action.kind === 'press') ? ['Key'] : []), ...(recording.actions.some(action => action.kind === 'assert-visible') ? ['until'] : [])]
  const thousandEyesImports = [...(recording.actions.some(action => action.kind === 'fill' && action.value.kind === 'secret') ? ['credentials'] : []), 'driver', ...(recording.thousandEyes.markers.length ? ['markers'] : [])]

  return `import { ${seleniumImports.join(', ')} } from 'selenium-webdriver';
import { ${thousandEyesImports.join(', ')} } from 'thousandeyes';

`
}

function helpers(actions: RecordedAction[]): string {
  return [actions.some(isLocatedAction) ? findElementHelper : '', actions.some(action => action.kind === 'fill') ? fillHelper : '', actions.some(action => action.kind === 'check') ? setCheckedHelper : ''].join('')
}

function isLocatedAction(action: RecordedAction): action is LocatedAction {
  return 'locatorCandidates' in action
}

function unsupported(behavior: string): never {
  throw new Error(`${behavior} are not supported`)
}

const specialKeys: Readonly<Record<string, string>> = {
  Alt: 'Key.ALT',
  ArrowDown: 'Key.ARROW_DOWN',
  ArrowLeft: 'Key.ARROW_LEFT',
  ArrowRight: 'Key.ARROW_RIGHT',
  ArrowUp: 'Key.ARROW_UP',
  Backspace: 'Key.BACK_SPACE',
  Control: 'Key.CONTROL',
  Delete: 'Key.DELETE',
  End: 'Key.END',
  Enter: 'Key.ENTER',
  Escape: 'Key.ESCAPE',
  Home: 'Key.HOME',
  Insert: 'Key.INSERT',
  Meta: 'Key.META',
  PageDown: 'Key.PAGE_DOWN',
  PageUp: 'Key.PAGE_UP',
  Space: 'Key.SPACE',
  Shift: 'Key.SHIFT',
  Tab: 'Key.TAB',
  ...Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`F${index + 1}`, `Key.F${index + 1}`])),
}

const findElementHelper = `

async function findElement(locator, framePath = []) {
  await driver.switchTo().defaultContent();

  for (const frameLocator of framePath) {
    await driver.switchTo().frame(await driver.findElement(By.css(frameLocator)));
  }

  return driver.findElement(locator);
}`

const fillHelper = `

async function fill(element, value) {
  await element.clear();
  await element.sendKeys(value);
}`

const setCheckedHelper = `

async function setChecked(element, checked) {
  if (await driver.executeScript('return arguments[0].checked === arguments[1];', element, checked)) return;

  await element.click();

  if (await driver.executeScript('return arguments[0].checked === arguments[1];', element, checked)) return;

  throw new Error('Element did not reach the requested checked state.');
}`

type LocatedAction = Extract<RecordedAction, { locatorCandidates: unknown }>
type ClickAction = Extract<RecordedAction, { kind: 'click' }>
type HoverAction = Extract<RecordedAction, { kind: 'hover' }>
type PressAction = Extract<RecordedAction, { kind: 'press' }>
