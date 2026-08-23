import type { AriaLocatorCandidate, AriaLocatorOptions, AriaLocatorStep } from './types.ts'
import { beginAriaCaches, endAriaCaches, getAriaRole, getElementAccessibleName, isElementHiddenForAria } from './vendor/playwright/injected/roleUtils.ts'
import { getElementLabels, type ElementText } from './vendor/playwright/injected/selectorUtils.ts'
import { normalizeWhiteSpace } from './vendor/playwright/isomorphic/stringUtils.ts'

export { generateAriaLocatorCandidates }

function generateAriaLocatorCandidates(options: AriaLocatorOptions): AriaLocatorCandidate[] {
  beginAriaCaches()
  try {
    return generateAriaLocatorCandidatesInternal(options)
  } finally {
    endAriaCaches()
  }
}

function generateAriaLocatorCandidatesInternal(options: AriaLocatorOptions): AriaLocatorCandidate[] {
  const elementCache = new Map<Node, Element[]>()
  const inaccessibleCache = new Map<Element, boolean>()
  const labelCache = new Map<Element, string[]>()
  const labelTextCache = new Map<Element | ShadowRoot, ElementText>()
  const nameCache = new Map<Element, string>()
  const roleCache = new Map<Element, string | null>()
  const getShadowRoot = options.getShadowRoot ?? (element => element.shadowRoot)
  const isExcluded = options.excludeElement ?? (() => false)

  if (isExcluded(options.target) || elementIsInaccessible(options.target)) {
    return []
  }

  const targetSteps = getTargetSteps(options.target)
  const candidates: AriaLocatorCandidate[] = [
    ...targetSteps.map<AriaLocatorCandidate>(step => ({ steps: [step] })),
    ...getAccessibleAncestors(options.target).flatMap(ancestor => {
      const name = getName(ancestor)
      const role = getElementRole(ancestor)

      return name && role ? targetSteps.map<AriaLocatorCandidate>(step => ({ steps: [{ exact: true, method: 'role', name, role }, step] })) : []
    }),
  ]
  const candidate = candidates.find(uniquelyMatchesTarget)

  return candidate ? [candidate] : []

  function uniquelyMatchesTarget(candidate: AriaLocatorCandidate): boolean {
    const matches = candidate.steps.reduce<Element[]>((scopes, step) => [...new Set(scopes.flatMap(scope => resolveStep(scope, step)))], [options.target.ownerDocument.documentElement])

    return matches.length === 1 && matches[0] === options.target
  }

  function resolveStep(scope: Element, step: AriaLocatorStep): Element[] {
    const elements = getElements(scope)

    return step.method === 'role' ? elements.filter(element => getElementRole(element) === step.role && !elementIsInaccessible(element) && (step.name === undefined || getName(element) === step.name)) : elements.filter(element => getLabels(element).includes(step.text))
  }

  function getTargetSteps(element: Element): AriaLocatorStep[] {
    const name = getName(element)
    const role = getElementRole(element)
    const namedRole = name && role ? [{ exact: true as const, method: 'role' as const, name, role }] : []
    const labels = getLabels(element).map(text => ({ exact: true as const, method: 'label' as const, text }))
    const unnamedRole = role ? [{ method: 'role' as const, role }] : []

    return [...namedRole, ...labels, ...unnamedRole]
  }

  function getAccessibleAncestors(element: Element): Element[] {
    const ancestors: Element[] = []
    let current = getParent(element)

    while (current && ancestors.length < 5) {
      if (!isExcluded(current) && !elementIsInaccessible(current)) {
        ancestors.push(current)
      }
      current = getParent(current)
    }

    return ancestors
  }

  function getElements(scope: QueryScope): Element[] {
    const cached = elementCache.get(scope)

    if (cached) {
      return cached
    }

    const elements = [...scope.querySelectorAll('*')].filter(element => !isExcluded(element))

    for (const element of elements.slice()) {
      const shadowRoot = getShadowRoot(element)

      if (shadowRoot) {
        elements.push(...getElements(shadowRoot))
      }
    }

    elementCache.set(scope, elements)
    return elements
  }

  function getName(element: Element): string {
    const cached = nameCache.get(element)

    if (cached !== undefined) {
      return cached
    }

    const name = normalizeWhiteSpace(getElementAccessibleName(element, false))

    nameCache.set(element, name)
    return name
  }

  function getElementRole(element: Element): string | null {
    if (roleCache.has(element)) {
      return roleCache.get(element) ?? null
    }

    const role = getAriaRole(element)

    roleCache.set(element, role)
    return role
  }

  function elementIsInaccessible(element: Element): boolean {
    if (inaccessibleCache.has(element)) {
      return inaccessibleCache.get(element) ?? false
    }

    const inaccessible = isElementHiddenForAria(element)

    inaccessibleCache.set(element, inaccessible)
    return inaccessible
  }

  function getLabels(element: Element): string[] {
    const cached = labelCache.get(element)

    if (cached) {
      return cached
    }

    const labels = [
      ...new Set(
        getElementLabels(labelTextCache, element)
          .map(label => label.normalized)
          .filter(Boolean),
      ),
    ]

    labelCache.set(element, labels)
    return labels
  }

  function getParent(element: Element): Element | undefined {
    const root = element.getRootNode()

    return element.parentElement ?? (root instanceof ShadowRoot ? root.host : undefined)
  }
}

type QueryScope = Element | ShadowRoot
