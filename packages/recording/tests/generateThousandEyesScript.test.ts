import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'
import { describe, expect, test } from 'vitest'

import { generateThousandEyesScript, type RecordedAction, type RecordedLocator, type Recording } from '@te/recorder-recording'

describe('ThousandEyes script generation', () => {
  test('generates supported actions in recorded order', () => {
    expect(
      generateThousandEyesScript(
        recording([
          action({ kind: 'goto', url: 'https://example.com/start' }),
          action({ kind: 'fill', locatorCandidates: locators(), value: { kind: 'plain-text', value: 'hello' } }),
          action({ button: 'left', clickCount: 1, kind: 'click', locatorCandidates: locators() }),
          action({ checked: true, kind: 'check', locatorCandidates: locators() }),
          action({ key: 'Enter', kind: 'press', locatorCandidates: locators(), modifiers: ['Control'] }),
          action({ kind: 'hover', locatorCandidates: locators() }),
          action({ kind: 'assert-visible', locatorCandidates: locators() }),
          action({ kind: 'go-back' }),
          action({ kind: 'go-forward' }),
          action({ kind: 'reload' }),
        ]),
      ),
    ).toMatchObject({
      language: 'javascript',
      source: expect.stringContaining(`  await driver.get("https://example.com/start");
  await fill(await findElement(By.css("#target")), "hello");
  await (await findElement(By.css("#target"))).click();
  await setChecked(await findElement(By.css("#target")), true);
  await (await findElement(By.css("#target"))).sendKeys(Key.chord(Key.CONTROL, Key.ENTER));
  await driver.actions().move({ origin: await findElement(By.css("#target")) }).perform();
  await driver.wait(until.elementIsVisible(await findElement(By.css("#target"))));
  await driver.navigate().back();
  await driver.navigate().forward();
  await driver.navigate().refresh();`),
    })
  })

  test('generates frame, test ID, credential, and escaping support', () => {
    expect(
      generateThousandEyesScript(
        recording([
          action({
            kind: 'fill',
            locatorCandidates: locators({ framePath: ['#outer', 'iframe[name="inner"]'], kind: 'test-id', value: 'password"field' }),
            value: { kind: 'secret', name: 'ACCOUNT_PASSWORD' },
          }),
        ]),
      ).source,
    ).toContain(String.raw`await fill(await findElement(By.css("[data-testid=\"password\\\"field\"]"), ["#outer", "iframe[name=\"inner\"]"]), credentials.get("ACCOUNT_PASSWORD"));`)
  })

  test('generates markers and screenshots at action boundaries, deferring screenshots until after active markers', () => {
    const source = generateThousandEyesScript({
      ...recording([action({ kind: 'goto', url: 'https://example.com/start' }), action({ kind: 'fill', locatorCandidates: locators(), value: { kind: 'plain-text', value: 'hello' } }), action({ kind: 'click', locatorCandidates: locators() }), action({ kind: 'assert-visible', locatorCandidates: locators() })]),
      thousandEyes: {
        markers: [
          { end: 3, name: 'Sign in', start: 1 },
          { end: 4, name: 'Confirm', start: 3 },
        ],
        screenshots: [{ at: 0 }, { at: 2 }, { at: 4 }],
      },
    }).source

    expect(source).toContain("import { driver, markers } from 'thousandeyes';")
    expect(source).toContain(`  await driver.takeScreenshot();
  await driver.get("https://example.com/start");
  markers.start("Sign in");
  await fill(await findElement(By.css("#target")), "hello");
  await (await findElement(By.css("#target"))).click();
  markers.stop("Sign in");
  markers.start("Confirm");
  await driver.wait(until.elementIsVisible(await findElement(By.css("#target"))));
  markers.stop("Confirm");
  await driver.takeScreenshot();
  await driver.takeScreenshot();`)
  })

  test('defers a screenshot beyond overlapping markers', () => {
    const source = generateThousandEyesScript({
      ...recording([action({ kind: 'go-back' }), action({ kind: 'go-forward' }), action({ kind: 'reload' }), action({ kind: 'go-back' }), action({ kind: 'go-forward' })]),
      thousandEyes: {
        markers: [
          { end: 3, name: 'First', start: 0 },
          { end: 5, name: 'Second', start: 2 },
        ],
        screenshots: [{ at: 0 }],
      },
    }).source

    expect(source.indexOf('await driver.takeScreenshot();')).toBeGreaterThan(source.indexOf('markers.stop("Second");'))
  })

  test.each([
    {
      markers: [
        { end: 1, name: 'Repeated', start: 0 },
        { end: 2, name: 'Repeated', start: 1 },
      ],
      reason: 'Marker names must be unique',
      screenshots: [],
    },
    { markers: [{ end: 1, name: 'Empty', start: 1 }], reason: 'Marker start must be before marker end', screenshots: [] },
    { markers: [{ end: 3, name: 'Outside', start: 0 }], reason: 'Marker positions must be within the action boundaries', screenshots: [] },
    { markers: [], reason: 'Screenshot positions must be within the action boundaries', screenshots: [{ at: 3 }] },
    { markers: [], reason: 'Only one screenshot can be taken at an action boundary', screenshots: [{ at: 1 }, { at: 1 }] },
  ])('rejects invalid ThousandEyes annotations: $reason', ({ markers, reason, screenshots }) => {
    expect(() => generateThousandEyesScript({ ...recording([action({ kind: 'go-back' }), action({ kind: 'go-forward' })]), thousandEyes: { markers, screenshots } })).toThrow(reason)
  })

  test.each([
    { input: action({ button: 'right', kind: 'click', locatorCandidates: locators() }), reason: 'right-button clicks' },
    { input: action({ clickCount: 2, kind: 'click', locatorCandidates: locators() }), reason: 'clicks with a click count of 2' },
    { input: action({ kind: 'click', locatorCandidates: locators(), modifiers: ['Shift'] }), reason: 'clicks with modifiers' },
    { input: action({ kind: 'click', locatorCandidates: locators(), position: { x: 1, y: 2 } }), reason: 'positioned clicks' },
    { input: action({ kind: 'hover', locatorCandidates: locators(), position: { x: 1, y: 2 } }), reason: 'positioned hover actions' },
    { input: action({ kind: 'select', locatorCandidates: locators(), options: ['one'] }), reason: 'select actions' },
    { input: action({ files: ['/tmp/file.txt'], kind: 'set-input-files', locatorCandidates: locators() }), reason: 'file upload actions' },
    { input: action({ key: 'UnsupportedKey', kind: 'press', locatorCandidates: locators() }), reason: 'the "UnsupportedKey" key' },
  ])('fails fast for unsupported action semantics: $reason', ({ input, reason }) => {
    expect(() => generateThousandEyesScript(recording([input]))).toThrow(`Cannot export action 0 (${input.kind}) to ThousandEyes: ${reason} are not supported.`)
  })

  test('does not fall back from an unsupported primary locator', () => {
    expect(() =>
      generateThousandEyesScript(
        recording([
          action({
            kind: 'click',
            locatorCandidates: [
              { kind: 'aria', steps: [{ method: 'role', name: 'Save', role: 'button' }] },
              { kind: 'css', value: '#save' },
            ],
          }),
        ]),
      ),
    ).toThrow('Cannot export action 0 (click) to ThousandEyes: ARIA locators are not supported.')
  })

  test('generates deterministic, syntactically valid JavaScript', () => {
    const input = recording([action({ kind: 'fill', locatorCandidates: locators(), value: { kind: 'plain-text', value: 'line one\nline two\u2028line three\u2029' } })])
    const first = generateThousandEyesScript(input)

    expect(generateThousandEyesScript(input)).toStrictEqual(first)
    expect(
      transpileModule(first.source, {
        compilerOptions: { allowJs: true, module: ModuleKind.ESNext, target: ScriptTarget.ESNext },
        fileName: 'recording.js',
        reportDiagnostics: true,
      }).diagnostics,
    ).toStrictEqual([])
    expect(first.source).toContain('"line one\\nline two\\u2028line three\\u2029"')
  })

  test('validates the recording before generating source', () => {
    expect(() => generateThousandEyesScript({ ...recording([]), startUrl: 'not a URL' } as Recording)).toThrow()
  })
})

function action(value: RecordedActionInput): RecordedAction {
  return { ...value, pageUrl: 'https://example.com/current' } as RecordedAction
}

function recording(actions: RecordedAction[]): Recording {
  return { actions, createdAt: '2026-08-24T12:00:00.000Z', startUrl: 'https://example.com/start', thousandEyes: { markers: [], screenshots: [] }, title: 'Generated transaction' }
}

function locators(primary: RecordedLocator = { kind: 'css', value: '#target' }): [RecordedLocator, ...RecordedLocator[]] {
  return [primary, { kind: 'css', value: '#fallback' }]
}

type RecordedActionInput = {
  [Kind in RecordedAction['kind']]: Omit<Extract<RecordedAction, { kind: Kind }>, 'pageUrl'>
}[RecordedAction['kind']]
