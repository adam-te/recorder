import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'
import { describe, expect, test } from 'vitest'

import { generatePlaywrightScript, type RecordedAction, type RecordedLocator, type Recording } from '@te/recorder-core'

describe('Playwright script generation', () => {
  test.each(getActionGenerationCases())('generates $name actions', ({ action: recordedAction, expected }) => {
    expect(generatePlaywrightScript(createRecordingFixture([action(recordedAction)]))).toContain(`  ${expected}\n`)
  })

  test('preserves recorded action order', () => {
    expect(generatePlaywrightScript(createRecordingFixture([action({ kind: 'go-back' }), action({ kind: 'go-forward' })]))).toContain('  await page.goBack()\n  await page.goForward()')
  })

  test('generates nested frame locators', () => {
    const source = generatePlaywrightScript(createRecordingFixture([action({ kind: 'click', locatorCandidates: locators({ framePath: ['#outer', 'iframe[name="inner"]'], kind: 'css', value: '#target' }) })]))

    expect(source).toContain(String.raw`await page.locator("#outer").contentFrame().locator("iframe[name=\"inner\"]").contentFrame().locator("#target").click()`)
  })

  test('generates chained ARIA locators', () => {
    const source = generatePlaywrightScript(
      createRecordingFixture([
        action({
          kind: 'click',
          locatorCandidates: locators({
            kind: 'aria',
            steps: [
              { exact: true, method: 'role', name: 'Settings', role: 'dialog' },
              { exact: false, method: 'label', text: 'Save' },
            ],
          }),
        }),
      ]),
    )

    expect(source).toContain('page.getByRole("dialog", { name: "Settings", exact: true }).getByLabel("Save", { exact: false }).click()')
  })

  test('generates locators from the first candidate', () => {
    const source = generatePlaywrightScript(createRecordingFixture([action({ kind: 'click', locatorCandidates: locators() })]))

    expect(source).toContain('page.locator("#target").click()')
    expect(source).not.toContain('#fallback')
  })

  test('reads secret fills from environment variables without embedding values', () => {
    const source = generatePlaywrightScript(createRecordingFixture([action({ kind: 'fill', locatorCandidates: locators(), value: { kind: 'secret', name: 'ACCOUNT_PASSWORD' } })]))

    expect(source).toBe(`import { test } from 'playwright/test'

test("Every action", async ({ page }) => {
  await page.locator("#target").fill(requiredSecret("ACCOUNT_PASSWORD"))
})

function requiredSecret(name: string): string {
  const value = process.env[name]

  if (value === undefined) {
    throw new Error(\`Missing required secret: \${name}\`)
  }

  return value
}
`)
  })

  test('escapes strings that would otherwise change the generated source structure', () => {
    const source = generatePlaywrightScript(createRecordingFixture([action({ kind: 'fill', locatorCandidates: locators({ kind: 'css', value: 'input\n"quoted"' }), value: { kind: 'plain-text', value: 'line one\nline two\u2028line three\u2029' } })], 'Title\n"quoted"'))

    expect(source).toContain('test("Title\\n\\"quoted\\"", async ({ page }) => {')
    expect(source).toContain('page.locator("input\\n\\"quoted\\"").fill("line one\\nline two\\u2028line three\\u2029")')
  })

  test('generates a valid empty test', () => {
    const source = generatePlaywrightScript(createRecordingFixture([], 'Empty recording'))

    expect(source).toBe(`import { test } from 'playwright/test'

test("Empty recording", async ({ page }) => {

})
`)
  })

  test('generates syntactically valid TypeScript', () => {
    const source = generatePlaywrightScript(createRecordingFixture([action({ kind: 'click', locatorCandidates: locators() })]))
    const result = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ESNext }, fileName: 'recording.spec.ts', reportDiagnostics: true })

    expect(result.diagnostics).toStrictEqual([])
  })

  test('validates the recording before generating source', () => {
    expect(() => generatePlaywrightScript({ ...createRecordingFixture([]), startUrl: 'not a URL' } as Recording)).toThrow()
  })
})

function action(action: RecordedActionInput): RecordedAction {
  return { ...action, pageUrl: 'https://example.com/current' } as RecordedAction
}

function createRecordingFixture(actions: RecordedAction[], title = 'Every action'): Recording {
  return { actions, createdAt: '2026-08-24T12:00:00.000Z', startUrl: 'https://metadata.example/not-used', title }
}

function locators(primary: RecordedLocator = { kind: 'css', value: '#target' }): [RecordedLocator, ...RecordedLocator[]] {
  return [primary, { kind: 'css', value: '#fallback' }]
}

function getActionGenerationCases(): ActionGenerationCase[] {
  return [
    { action: { kind: 'goto', url: 'https://example.com/start' }, expected: 'await page.goto("https://example.com/start")', name: 'goto' },
    { action: { kind: 'go-back' }, expected: 'await page.goBack()', name: 'go-back' },
    { action: { kind: 'go-forward' }, expected: 'await page.goForward()', name: 'go-forward' },
    { action: { kind: 'reload' }, expected: 'await page.reload()', name: 'reload' },
    { action: { kind: 'click', locatorCandidates: locators() }, expected: 'await page.locator("#target").click()', name: 'click' },
    {
      action: { button: 'right', clickCount: 2, kind: 'click', locatorCandidates: locators(), modifiers: ['Control', 'Shift'], position: { x: 12, y: 34 } },
      expected: 'await page.locator("#target").click({ button: "right", clickCount: 2, modifiers: ["Control", "Shift"], position: { x: 12, y: 34 } })',
      name: 'configured click',
    },
    { action: { kind: 'fill', locatorCandidates: locators(), value: { kind: 'plain-text', value: 'hello "world"' } }, expected: 'await page.locator("#target").fill("hello \\"world\\"")', name: 'fill' },
    { action: { checked: true, kind: 'check', locatorCandidates: locators() }, expected: 'await page.locator("#target").check()', name: 'check' },
    { action: { checked: false, kind: 'check', locatorCandidates: locators() }, expected: 'await page.locator("#target").uncheck()', name: 'uncheck' },
    { action: { key: 'Enter', kind: 'press', locatorCandidates: locators(), modifiers: ['Alt'] }, expected: 'await page.locator("#target").press("Alt+Enter")', name: 'press' },
    { action: { kind: 'select', locatorCandidates: locators(), options: ['one', 'two'] }, expected: 'await page.locator("#target").selectOption(["one", "two"])', name: 'select' },
    { action: { kind: 'hover', locatorCandidates: locators() }, expected: 'await page.locator("#target").hover()', name: 'hover' },
    { action: { kind: 'hover', locatorCandidates: locators(), position: { x: 5, y: 8 } }, expected: 'await page.locator("#target").hover({ position: { x: 5, y: 8 } })', name: 'positioned hover' },
    { action: { files: ['/tmp/one.txt', '/tmp/two.txt'], kind: 'set-input-files', locatorCandidates: locators() }, expected: 'await page.locator("#target").setInputFiles(["/tmp/one.txt", "/tmp/two.txt"])', name: 'set-input-files' },
    { action: { kind: 'assert-visible', locatorCandidates: locators() }, expected: 'await page.locator("#target").waitFor({ state: "visible" })', name: 'assert-visible' },
  ]
}

type RecordedActionInput = {
  [Kind in RecordedAction['kind']]: Omit<Extract<RecordedAction, { kind: Kind }>, 'pageUrl'>
}[RecordedAction['kind']]

interface ActionGenerationCase {
  action: RecordedActionInput
  expected: string
  name: string
}
