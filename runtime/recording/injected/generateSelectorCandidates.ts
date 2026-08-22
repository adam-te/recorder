import type { CapturedCssSelector } from './types.ts'

export { generateSelectorCandidates, SELECTOR_GENERATOR_NAME }

const SELECTOR_GENERATOR_NAME = '__thousandEyesRecorderGenerateSelector'

function generateSelectorCandidates(element: Element, maxCandidates = 3): CapturedCssSelector[] {
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1) {
    throw new Error('Selector candidate limit must be a positive integer.')
  }

  const compoundFragmentInputLimit = 8
  const root = element.getRootNode() as Document | ShadowRoot
  const localSelectors = getLocalSelectors(element, root)
  const selectors = root instanceof ShadowRoot ? localSelectors.map(selector => `${generateSelectorCandidates(root.host, 1)[0]!.value} ${selector}`) : localSelectors

  return selectors.map(value => ({ kind: 'css', value }))

  function getLocalSelectors(value: Element, currentRoot: Document | ShadowRoot): string[] {
    const candidates: string[] = []
    const stableFragments = getStableFragments(value)

    addSelectors(stableFragments)
    if (candidates.length < maxCandidates) {
      addSelectors(getAmbiguousCompoundFragments(stableFragments))
    }

    let ancestor = value.parentElement ?? undefined
    while (ancestor && candidates.length < maxCandidates) {
      if (!isDocumentStructureElement(ancestor)) {
        const ancestorStableFragments = getStableFragments(ancestor)

        for (const ancestorFragment of getFragmentsWithCompounds(ancestorStableFragments)) {
          addSelectors(getDescendantSelectors(ancestorFragment))
          if (candidates.length === maxCandidates) {
            break
          }
        }
      }
      ancestor = ancestor.parentElement ?? undefined
    }

    if (candidates.length < maxCandidates) {
      addSelectors([value.tagName.toLowerCase()])
    }
    if (candidates.length < maxCandidates) {
      addSelectors([getShortestStructuralSelector(value)])
    }

    return candidates

    function addSelectors(selectors: Iterable<string>): void {
      for (const selector of selectors) {
        if (candidates.length === maxCandidates) {
          break
        }
        if (selector && !candidates.includes(selector) && isUniqueMatch(selector)) {
          candidates.push(selector)
        }
      }
    }

    function* getAmbiguousCompoundFragments(fragments: string[]): Generator<string> {
      for (const fragment of getCompoundFragments(fragments)) {
        if (fragment.parts.every(part => !isUniqueMatch(part))) {
          yield fragment.value
        }
      }
    }

    function* getDescendantSelectors(ancestorFragment: string): Generator<string> {
      for (const targetFragment of getFragmentsWithCompounds(stableFragments)) {
        if (!isUniqueMatch(targetFragment)) {
          yield `${ancestorFragment} ${targetFragment}`
        }
      }
      const tagName = value.tagName.toLowerCase()
      if (!isUniqueMatch(tagName)) {
        yield `${ancestorFragment} ${tagName}`
      }
    }

    function isUniqueMatch(selector: string): boolean {
      const matches = currentRoot.querySelectorAll(selector)

      return matches.length === 1 && matches[0] === value
    }

    function getShortestStructuralSelector(target: Element): string {
      let selector = ''
      let current: Element | undefined = target

      while (current && !isDocumentStructureElement(current)) {
        const tagName = current.tagName.toLowerCase()
        const parent = (current.parentElement ?? current.getRootNode()) as Document | DocumentFragment | Element
        const siblings = [...parent.children].filter(candidate => candidate.tagName === current!.tagName)
        const segment = siblings.length > 1 ? `${tagName}:nth-of-type(${siblings.indexOf(current) + 1})` : tagName

        selector = [segment, selector].filter(Boolean).join(' ')
        if (isUniqueMatch(selector)) {
          return selector
        }
        current = current.parentElement ?? undefined
      }

      return selector
    }
  }

  function getStableFragments(value: Element): string[] {
    const attributes = [...value.attributes].filter(attribute => attribute.value && isAllowedSelectorAttribute(attribute, value))
    const testAttributeNames = ['data-testid', 'data-test-id', 'data-test', 'data-cy', 'data-qa']
    const semanticAttributeNames = ['href', 'name', 'aria-label', 'placeholder', 'title', 'alt', 'role', 'type']
    const testAttributes = getNamedAttributes(testAttributeNames)
    const semanticAttributes = [...getNamedAttributes(semanticAttributeNames), ...attributes.filter(attribute => attribute.name.startsWith('aria-') && !semanticAttributeNames.includes(attribute.name))]
    const dataAttributes = attributes.filter(attribute => attribute.name.startsWith('data-') && !testAttributeNames.includes(attribute.name))
    const categorizedAttributeNames = new Set([...testAttributes, ...semanticAttributes, ...dataAttributes].map(attribute => attribute.name))
    const unknownAttributes = attributes.filter(attribute => !categorizedAttributeNames.has(attribute.name))
    const id = value.id ? `#${CSS.escape(value.id)}` : undefined
    const classes = [...value.classList].map(className => `.${CSS.escape(className)}`)

    return [...new Set([...testAttributes.map(getAttributeFragment), id, ...semanticAttributes.map(getAttributeFragment), ...dataAttributes.map(getAttributeFragment), ...classes, ...unknownAttributes.map(getAttributeFragment)])].filter((fragment): fragment is string => Boolean(fragment))

    function getNamedAttributes(names: string[]): Attr[] {
      return names.map(name => attributes.find(attribute => attribute.name === name)).filter((attribute): attribute is Attr => Boolean(attribute))
    }
  }

  function getAttributeFragment(attribute: Attr): string {
    return `[${CSS.escape(attribute.name)}="${escapeAttribute(attribute.value)}"]`
  }

  function isAllowedSelectorAttribute(attribute: Attr, elementValue: Element): boolean {
    const excludedAttributes = ['id', 'class', 'style', 'value', 'nonce', 'srcdoc', 'checked', 'selected', 'disabled', 'hidden', 'open', 'aria-expanded', 'aria-pressed', 'data-thousandeyes-recorder-ui']
    const isEventHandler = attribute.name.startsWith('on') && attribute.name in elementValue

    return !excludedAttributes.includes(attribute.name) && !isEventHandler
  }

  function* getFragmentsWithCompounds(fragments: string[]): Generator<string> {
    yield* fragments
    for (const fragment of getCompoundFragments(fragments)) {
      yield fragment.value
    }
  }

  function* getCompoundFragments(fragments: string[]): Generator<CompoundFragment> {
    const compoundFragments = fragments.slice(0, compoundFragmentInputLimit)

    for (const size of [2, 3]) {
      yield* getCombinations(compoundFragments, size)
    }

    function* getCombinations(values: string[], size: number, selected: string[] = [], startIndex = 0): Generator<CompoundFragment> {
      if (selected.length === size) {
        yield { parts: selected, value: selected.join('') }
      } else {
        for (let index = startIndex; index <= values.length - (size - selected.length); index += 1) {
          yield* getCombinations(values, size, [...selected, values[index]!], index + 1)
        }
      }
    }
  }

  function escapeAttribute(value: string): string {
    return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\a ')
  }

  function isDocumentStructureElement(value: Element): boolean {
    return value.tagName === 'HTML' || value.tagName === 'BODY'
  }
}

interface CompoundFragment {
  parts: string[]
  value: string
}
