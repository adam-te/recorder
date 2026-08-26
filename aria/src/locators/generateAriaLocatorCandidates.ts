import { tryTo } from '@te/recorder-utils'

import { beginAriaCaches, endAriaCaches } from '../../vendor/playwright/injected/roleUtils.ts'
import type { AriaLocatorOptions } from '../types/browser.ts'
import type { AriaLocatorCandidate, AriaLocatorStep } from '../types/locators.ts'
import { createAriaQueryContext, type AriaQueryContext } from './createAriaQueryContext.ts'

export { generateAriaLocatorCandidates }

function generateAriaLocatorCandidates(options: AriaLocatorOptions): AriaLocatorCandidate[] {
  beginAriaCaches()
  return tryTo(() => generateAriaLocatorCandidatesInternal(options), undefined, endAriaCaches)
}

function generateAriaLocatorCandidatesInternal(options: AriaLocatorOptions): AriaLocatorCandidate[] {
  const query = createAriaQueryContext(options)

  if (query.isExcluded(options.target) || query.isInaccessible(options.target)) {
    return []
  }

  const targetSteps = getTargetSteps(query, options.target)
  const candidates: AriaLocatorCandidate[] = [
    ...targetSteps.flatMap(step => withNecessaryExactness([step])),
    ...query.getAccessibleAncestors(options.target).flatMap(ancestor => {
      const name = query.getName(ancestor)
      const role = query.getRole(ancestor)

      return name && role ? targetSteps.flatMap(step => withNecessaryExactness([{ method: 'role', name, role }, step])) : []
    }),
  ]
  const candidate = candidates.find(candidate => uniquelyMatchesTarget(query, options.target, candidate))

  return candidate ? [candidate] : []
}

function getTargetSteps(query: AriaQueryContext, element: Element): AriaLocatorStep[] {
  const name = query.getName(element)
  const role = query.getRole(element)
  const text = query.getText(element)

  return [
    ...(name && role ? [{ method: 'role' as const, name, role }] : []),
    ...query.getLabels(element).map(text => ({ method: 'label' as const, text })),
    ...getAttributeStep('alt'),
    ...getAttributeStep('placeholder'),
    ...(text ? [{ method: 'text' as const, text }] : []),
    ...getAttributeStep('title'),
    ...(role ? [{ method: 'role' as const, role }] : []),
  ]

  function getAttributeStep(method: 'alt' | 'placeholder' | 'title'): AriaLocatorStep[] {
    const text = element.getAttribute(method)

    return text ? [{ method, text }] : []
  }
}

function uniquelyMatchesTarget(query: AriaQueryContext, target: Element, candidate: AriaLocatorCandidate): boolean {
  const matches = candidate.steps.reduce<Element[]>((scopes, step) => [...new Set(scopes.flatMap(scope => query.findMatches(scope, step)))], [target.ownerDocument.documentElement])

  return matches.length === 1 && matches[0] === target
}

function withNecessaryExactness(steps: AriaLocatorStep[]): AriaLocatorCandidate[] {
  const exactableStepIndexes = steps.flatMap((step, index) => (step.method !== 'role' || step.name ? [index] : []))
  const candidates: AriaLocatorCandidate[] = []

  for (let exactCount = 0; exactCount <= exactableStepIndexes.length; exactCount++) {
    addCombinations(exactableStepIndexes.length - 1, exactCount, [])
  }

  return candidates

  function addCombinations(index: number, remaining: number, exactIndexes: number[]): void {
    if (remaining === 0) {
      const exactIndexSet = new Set(exactIndexes)
      candidates.push({ steps: steps.map((step, stepIndex) => (exactIndexSet.has(stepIndex) ? { ...step, exact: true } : step)) })
      return
    }

    if (index < 0 || index + 1 < remaining) {
      return
    }

    addCombinations(index - 1, remaining - 1, [...exactIndexes, exactableStepIndexes[index]])
    addCombinations(index - 1, remaining, exactIndexes)
  }
}
