import { ModuleKind, ScriptTarget, transpileModule } from 'typescript'
import { describe, expect, test } from 'vitest'

import { generatePlaywrightScript, type RecordedAction, type RecordedLocator, type RecordingDocument } from '@te/recorder-core'

describe('Playwright script generation', () => {
  test('generates every recorded action as Playwright TypeScript', () => {
    const source = generatePlaywrightScript(
      createDocument([
        action({ kind: 'goto', url: 'https://example.com/start' }),
        action({ kind: 'go-back' }),
        action({ kind: 'go-forward' }),
        action({ kind: 'reload' }),
        action({ kind: 'click', locatorCandidates: locators() }),
        action({ button: 'right', clickCount: 2, kind: 'click', locatorCandidates: locators(), modifiers: ['Control', 'Shift'], position: { x: 12, y: 34 } }),
        action({ kind: 'fill', locatorCandidates: locators(), value: { kind: 'plain-text', value: 'hello "world"' } }),
        action({ checked: true, kind: 'check', locatorCandidates: locators() }),
        action({ checked: false, kind: 'check', locatorCandidates: locators() }),
        action({ key: 'Enter', kind: 'press', locatorCandidates: locators(), modifiers: ['Alt'] }),
        action({ kind: 'select', locatorCandidates: locators(), options: ['one', 'two'] }),
        action({ kind: 'hover', locatorCandidates: locators() }),
        action({ kind: 'hover', locatorCandidates: locators(), position: { x: 5, y: 8 } }),
        action({ files: ['/tmp/one.txt', '/tmp/two.txt'], kind: 'set-input-files', locatorCandidates: locators() }),
        action({ kind: 'assert-visible', locatorCandidates: locators() }),
      ]),
    )

    expect(source).toBe(`import { test } from 'playwright/test'

test("Every action", async ({ page }) => {
  await page.goto("https://example.com/start")
  await page.goBack()
  await page.goForward()
  await page.reload()
  await page.locator("#target").click()
  await page.locator("#target").click({ button: "right", clickCount: 2, modifiers: ["Control", "Shift"], position: { x: 12, y: 34 } })
  await page.locator("#target").fill("hello \\"world\\"")
  await page.locator("#target").check()
  await page.locator("#target").uncheck()
  await page.locator("#target").press("Alt+Enter")
  await page.locator("#target").selectOption(["one", "two"])
  await page.locator("#target").hover()
  await page.locator("#target").hover({ position: { x: 5, y: 8 } })
  await page.locator("#target").setInputFiles(["/tmp/one.txt", "/tmp/two.txt"])
  await page.locator("#target").waitFor({ state: "visible" })
})
`)
  })

  test('generates nested frame and chained ARIA locators from the first candidate', () => {
    const primary: RecordedLocator = {
      framePath: ['#outer', 'iframe[name="inner"]'],
      kind: 'aria',
      steps: [
        { exact: true, method: 'role', name: 'Settings', role: 'dialog' },
        { exact: false, method: 'label', text: 'Save' },
      ],
    }
    const source = generatePlaywrightScript(createDocument([action({ kind: 'click', locatorCandidates: locators(primary) })]))

    expect(source).toContain(String.raw`await page.locator("#outer").contentFrame().locator("iframe[name=\"inner\"]").contentFrame().getByRole("dialog", { name: "Settings", exact: true }).getByLabel("Save", { exact: false }).click()`)
    expect(source).not.toContain('#fallback')
  })

  test('reads secret fills from environment variables without embedding values', () => {
    const source = generatePlaywrightScript(createDocument([action({ kind: 'fill', locatorCandidates: locators(), value: { kind: 'secret', name: 'ACCOUNT_PASSWORD' } })]))

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
    const source = generatePlaywrightScript(createDocument([action({ kind: 'fill', locatorCandidates: locators({ kind: 'css', value: 'input\n"quoted"' }), value: { kind: 'plain-text', value: 'line one\nline two\u2028line three\u2029' } })], 'Title\n"quoted"'))

    expect(source).toContain('test("Title\\n\\"quoted\\"", async ({ page }) => {')
    expect(source).toContain('page.locator("input\\n\\"quoted\\"").fill("line one\\nline two\\u2028line three\\u2029")')
  })

  test('generates a valid empty test', () => {
    const source = generatePlaywrightScript(createDocument([], 'Empty recording'))

    expect(source).toBe(`import { test } from 'playwright/test'

test("Empty recording", async ({ page }) => {

})
`)
  })

  test('generates syntactically valid TypeScript', () => {
    const source = generatePlaywrightScript(createDocument([action({ kind: 'click', locatorCandidates: locators() })]))
    const result = transpileModule(source, { compilerOptions: { module: ModuleKind.ESNext, target: ScriptTarget.ESNext }, fileName: 'recording.spec.ts', reportDiagnostics: true })

    expect(result.diagnostics).toStrictEqual([])
  })

  test('validates the recording before generating source', () => {
    expect(() => generatePlaywrightScript({ ...createDocument([]), startUrl: 'not a URL' } as RecordingDocument)).toThrow()
  })
})

function action(action: RecordedActionInput): RecordedAction {
  return { ...action, pageUrl: 'https://example.com/current' } as RecordedAction
}

function createDocument(actions: RecordedAction[], title = 'Every action'): RecordingDocument {
  return { actions, createdAt: '2026-08-24T12:00:00.000Z', startUrl: 'https://metadata.example/not-used', title }
}

function locators(primary: RecordedLocator = { kind: 'css', value: '#target' }): [RecordedLocator, ...RecordedLocator[]] {
  return [primary, { kind: 'css', value: '#fallback' }]
}

type RecordedActionInput = {
  [Kind in RecordedAction['kind']]: Omit<Extract<RecordedAction, { kind: Kind }>, 'pageUrl'>
}[RecordedAction['kind']]
