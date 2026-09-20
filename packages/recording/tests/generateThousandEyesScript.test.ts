import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'
import { describe, expect, test } from 'vitest'

import { generateThousandEyesScript, type ActionStep, type RecordedLocator, type RecordingSteps } from '@te/recorder-recording'

describe('ThousandEyes script generation', () => {
  test('generates supported actions in recorded order', () => {
    expect(
      generateThousandEyesScript([
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
      generateThousandEyesScript([
        action({
          kind: 'fill',
          locatorCandidates: locators({ framePath: ['#outer', 'iframe[name="inner"]'], kind: 'test-id', value: 'password"field' }),
          value: { kind: 'secret', name: 'ACCOUNT_PASSWORD' },
        }),
      ]).source,
    ).toContain(String.raw`await fill(await findElement(By.css("[data-testid=\"password\\\"field\"]"), ["#outer", "iframe[name=\"inner\"]"]), credentials.get("ACCOUNT_PASSWORD"));`)
  })

  test('generates markers and screenshots as ordinary steps', () => {
    const source = generateThousandEyesScript([
      { kind: 'screenshot' },
      action({ kind: 'goto', url: 'https://example.com/start' }),
      { kind: 'marker-start', name: 'Sign in' },
      action({ kind: 'fill', locatorCandidates: locators(), value: { kind: 'plain-text', value: 'hello' } }),
      action({ kind: 'click', locatorCandidates: locators() }),
      { kind: 'marker-end', name: 'Sign in' },
      { kind: 'marker-start', name: 'Confirm' },
      action({ kind: 'assert-visible', locatorCandidates: locators() }),
      { kind: 'marker-end', name: 'Confirm' },
      { kind: 'screenshot' },
    ]).source

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
  await driver.takeScreenshot();`)
  })

  test.each([
    {
      steps: [{ kind: 'marker-start', name: 'Repeated' }, action({ kind: 'go-back' }), { kind: 'marker-end', name: 'Repeated' }, { kind: 'marker-start', name: 'Repeated' }, action({ kind: 'go-forward' }), { kind: 'marker-end', name: 'Repeated' }],
      reason: 'Marker names must be unique',
    },
    { steps: [{ kind: 'marker-end', name: 'Missing' }], reason: 'A marker end must follow its matching marker start' },
    { steps: [{ kind: 'marker-start', name: 'Missing' }], reason: 'A marker start must have a matching marker end' },
  ])('rejects invalid annotation steps: $reason', ({ reason, steps }) => {
    expect(() => generateThousandEyesScript(steps as RecordingSteps)).toThrow(reason)
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
    expect(() => generateThousandEyesScript([input])).toThrow(`Cannot export action 0 (${input.kind}) to ThousandEyes: ${reason} are not supported.`)
  })

  test('does not fall back from an unsupported primary locator', () => {
    expect(() =>
      generateThousandEyesScript([
        action({
          kind: 'click',
          locatorCandidates: [
            { kind: 'aria', steps: [{ method: 'role', name: 'Save', role: 'button' }] },
            { kind: 'css', value: '#save' },
          ],
        }),
      ]),
    ).toThrow('Cannot export action 0 (click) to ThousandEyes: ARIA locators are not supported.')
  })

  test('generates deterministic, syntactically valid JavaScript', () => {
    const input: RecordingSteps = [action({ kind: 'fill', locatorCandidates: locators(), value: { kind: 'plain-text', value: 'line one\nline two\u2028line three\u2029' } })]
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
})

function action(value: ActionStepInput): ActionStep {
  return { ...value, pageUrl: 'https://example.com/current' } as ActionStep
}

function locators(primary: RecordedLocator = { kind: 'css', value: '#target' }): [RecordedLocator, ...RecordedLocator[]] {
  return [primary, { kind: 'css', value: '#fallback' }]
}

type ActionStepInput = {
  [Kind in ActionStep['kind']]: Omit<Extract<ActionStep, { kind: Kind }>, 'pageUrl'>
}[ActionStep['kind']]
