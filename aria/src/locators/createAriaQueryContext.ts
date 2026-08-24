import { getAriaRole, getElementAccessibleNameText, isElementHiddenForAria } from '../../vendor/playwright/injected/roleUtils.ts'
import { getElementLabels, type ElementText } from '../../vendor/playwright/injected/selectorUtils.ts'
import { normalizeWhiteSpace } from '../../vendor/playwright/isomorphic/stringUtils.ts'
import type { AriaLocatorOptions } from '../types/browser.ts'
import type { AriaLocatorStep } from '../types/locators.ts'

export { createAriaQueryContext }
export type { AriaQueryContext }

function createAriaQueryContext(options: AriaLocatorOptions): AriaQueryContext {
  const elementCache = new Map<Node, Element[]>()
  const inaccessibleCache = new Map<Element, boolean>()
  const labelCache = new Map<Element, string[]>()
  const labelTextCache = new Map<Element | ShadowRoot, ElementText>()
  const nameCache = new Map<Element, string>()
  const roleCache = new Map<Element, string | null>()
  const getShadowRoot = options.getShadowRoot ?? (element => element.shadowRoot)
  const isExcluded = options.excludeElement ?? (() => false)

  return { findMatches, getAccessibleAncestors, getLabels, getName, getRole, isExcluded, isInaccessible }

  function findMatches(scope: Element, step: AriaLocatorStep): Element[] {
    const elements = getElements(scope)

    return step.method === 'role' ? elements.filter(element => getRole(element) === step.role && !isInaccessible(element) && (step.name === undefined || textMatches(getName(element), step.name, step.exact))) : elements.filter(element => getLabels(element).some(label => textMatches(label, step.text, step.exact)))
  }

  function getAccessibleAncestors(element: Element): Element[] {
    const ancestors: Element[] = []
    let current = getParent(element)

    while (current && ancestors.length < 5) {
      if (!isExcluded(current) && !isInaccessible(current)) {
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

    const name = normalizeWhiteSpace(getElementAccessibleNameText(element, false))

    nameCache.set(element, name)
    return name
  }

  function getRole(element: Element): string | null {
    if (roleCache.has(element)) {
      return roleCache.get(element) ?? null
    }

    const role = getAriaRole(element)

    roleCache.set(element, role)
    return role
  }

  function isInaccessible(element: Element): boolean {
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
}

function getParent(element: Element): Element | undefined {
  const root = element.getRootNode()

  return element.parentElement ?? (root instanceof ShadowRoot ? root.host : undefined)
}

function textMatches(value: string, expected: string, exact: boolean | undefined): boolean {
  return exact ? value === expected : value.toLowerCase().includes(expected.toLowerCase())
}

interface AriaQueryContext {
  findMatches: (scope: Element, step: AriaLocatorStep) => Element[]
  getAccessibleAncestors: (element: Element) => Element[]
  getLabels: (element: Element) => string[]
  getName: (element: Element) => string
  getRole: (element: Element) => string | null
  isExcluded: (element: Element) => boolean
  isInaccessible: (element: Element) => boolean
}

type QueryScope = Element | ShadowRoot
