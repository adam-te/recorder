import type { CapturedCssSelector, CapturedSelector, CapturedTestIdSelector } from '#runtime/injected/protocol.ts'
import type { AriaLocatorOptions, AriaRuntime } from '@te/aria/browser'

export { generateLocatorCandidates }
export type { GenerateLocatorCandidates }

function generateLocatorCandidates(element: Element, generateCssSelectorCandidates: (element: Element) => CapturedCssSelector[], ariaRuntime: AriaRuntime, options: Omit<AriaLocatorOptions, 'target'> = {}): CapturedSelector[] {
  const testIdSelector = generateTestIdSelector(element, options)

  return [
    ...(testIdSelector ? [testIdSelector] : []),
    ...ariaRuntime.generateAriaLocatorCandidates({ ...options, target: element }).map(candidate => ({ ...candidate, kind: 'aria' as const })),
    ...generateCssSelectorCandidates(element).filter(selector => !testIdSelector || selector.value !== testIdCssSelector(testIdSelector.value)),
  ]
}

function generateTestIdSelector(element: Element, options: Omit<AriaLocatorOptions, 'target'>): CapturedTestIdSelector | undefined {
  const value = element.getAttribute('data-testid')

  if (!value || options.excludeElement?.(element)) {
    return undefined
  }

  const getShadowRoot = options.getShadowRoot ?? (candidate => candidate.shadowRoot)
  const matches: Element[] = []
  visit(element.ownerDocument)

  return matches.length === 1 && matches[0] === element ? { kind: 'test-id', value } : undefined

  function visit(root: Document | ShadowRoot): void {
    for (const candidate of root.querySelectorAll('[data-testid]')) {
      if (!options.excludeElement?.(candidate) && candidate.getAttribute('data-testid') === value) {
        matches.push(candidate)
      }
    }

    for (const candidate of root.querySelectorAll('*')) {
      if (options.excludeElement?.(candidate)) {
        continue
      }

      const shadowRoot = getShadowRoot(candidate)

      if (shadowRoot) {
        visit(shadowRoot)
      }
    }
  }
}

function testIdCssSelector(value: string): string {
  return `[data-testid="${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\a ')}"]`
}

type GenerateLocatorCandidates = typeof generateLocatorCandidates
