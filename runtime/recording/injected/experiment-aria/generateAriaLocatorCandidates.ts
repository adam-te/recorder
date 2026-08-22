import type { CapturedAriaSelector, CapturedAriaSelectorStep } from '#recorder-runtime/recording/injected/types.ts'

export { generateAriaLocatorCandidates }
export type { DomAccessibilityApi }

function generateAriaLocatorCandidates(args: GenerateAriaLocatorCandidatesArgs): CapturedAriaSelector[] {
  const elementCache = new Map<Node, Element[]>()
  const inaccessibleCache = new Map<Element, boolean>()
  const nameCache = new Map<Element, string>()
  const roleCache = new Map<Element, string | null>()

  if (isInaccessible(args.target)) {
    return []
  }

  const targetSteps = getTargetSteps(args.target)
  const candidates: CapturedAriaSelector[] = [
    ...targetSteps.map<CapturedAriaSelector>(step => ({ kind: 'aria', steps: [step] })),
    ...getAccessibleAncestors(args.target).flatMap(ancestor => {
      const name = getName(ancestor)
      const role = getRole(ancestor)

      return name && role ? targetSteps.map<CapturedAriaSelector>(step => ({ kind: 'aria', steps: [{ exact: true, method: 'role', name, role }, step] })) : []
    }),
  ]
  const candidate = candidates.find(uniquelyMatchesTarget)

  return candidate ? [candidate] : []

  function uniquelyMatchesTarget(candidate: CapturedAriaSelector): boolean {
    const matches = candidate.steps.reduce<Element[]>((scopes, step) => [...new Set(scopes.flatMap(scope => resolveStep(scope, step)))], [args.target.ownerDocument.documentElement])

    return matches.length === 1 && matches[0] === args.target
  }

  function resolveStep(scope: Element, step: CapturedAriaSelectorStep): Element[] {
    const elements = getElements(scope)

    return step.method === 'role' ? elements.filter(element => getRole(element) === step.role && !isInaccessible(element) && (step.name === undefined || getName(element) === step.name)) : elements.filter(element => hasLabelSource(element) && !isInaccessible(element) && getName(element) === step.text)
  }

  function getTargetSteps(element: Element): CapturedAriaSelectorStep[] {
    const name = getName(element)
    const role = getRole(element)
    const namedRole = name && role ? [{ exact: true as const, method: 'role' as const, name, role }] : []
    const label = name && hasLabelSource(element) ? [{ exact: true as const, method: 'label' as const, text: name }] : []
    const unnamedRole = role ? [{ method: 'role' as const, role }] : []

    return [...namedRole, ...label, ...unnamedRole]
  }

  function getAccessibleAncestors(element: Element): Element[] {
    const ancestors: Element[] = []
    let current = getParent(element)

    while (current && ancestors.length < 5) {
      if (!isInaccessible(current)) {
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

    const elements = [...scope.querySelectorAll('*')]

    for (const element of elements.slice()) {
      if (element.shadowRoot) {
        elements.push(...getElements(element.shadowRoot))
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

    const name = args.api.computeAccessibleName(element).replace(/\s+/g, ' ').trim()

    nameCache.set(element, name)
    return name
  }

  function getRole(element: Element): string | null {
    if (roleCache.has(element)) {
      return roleCache.get(element) ?? null
    }

    const role = args.api.getRole(element)

    roleCache.set(element, role)
    return role
  }

  function isInaccessible(element: Element): boolean {
    if (inaccessibleCache.has(element)) {
      return inaccessibleCache.get(element) ?? false
    }

    const inaccessible = args.api.isInaccessible(element)

    inaccessibleCache.set(element, inaccessible)
    return inaccessible
  }

  function hasLabelSource(element: Element): boolean {
    const labels = 'labels' in element ? (element as HTMLInputElement).labels : null

    return Boolean(labels?.length || element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby'))
  }

  function getParent(element: Element): Element | undefined {
    const root = element.getRootNode()

    return element.parentElement ?? (root instanceof ShadowRoot ? root.host : undefined)
  }
}

interface DomAccessibilityApi {
  computeAccessibleDescription: (element: Element) => string
  computeAccessibleName: (element: Element) => string
  getRole: (element: Element) => string | null
  isDisabled: (element: Element) => boolean
  isInaccessible: (element: Element) => boolean
}

interface GenerateAriaLocatorCandidatesArgs {
  api: DomAccessibilityApi
  target: Element
}

type QueryScope = Element | ShadowRoot
