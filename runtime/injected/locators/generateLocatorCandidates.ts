import type { CapturedCssSelector, CapturedSelector } from '#runtime/injected/protocol.ts'
import type { AriaLocatorOptions, AriaRuntime } from '@te/aria/browser'

export { generateLocatorCandidates }
export type { GenerateLocatorCandidates }

function generateLocatorCandidates(element: Element, generateCssSelectorCandidates: (element: Element) => CapturedCssSelector[], ariaRuntime: AriaRuntime, options: Omit<AriaLocatorOptions, 'target'> = {}): CapturedSelector[] {
  const ariaSelectors = ariaRuntime.generateAriaLocatorCandidates({ ...options, target: element }).map(candidate => ({ ...candidate, kind: 'aria' as const }))

  return [...ariaSelectors, ...generateCssSelectorCandidates(element)]
}

type GenerateLocatorCandidates = typeof generateLocatorCandidates
