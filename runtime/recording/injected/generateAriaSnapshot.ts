import type { DomAccessibilityApi } from './experiment-aria/generateAriaLocatorCandidates.ts'

export { generateAriaSnapshot }
export type { CapturedAriaSnapshot }

function generateAriaSnapshot(args: GenerateAriaSnapshotArgs): CapturedAriaSnapshot {
  const inaccessibleCache = new Map<Element, boolean>()
  const visited = new Set<Node>()
  const refs = new Map<Element, string>()
  const lines: string[] = []
  const root = args.target.ownerDocument.body ?? args.target.ownerDocument.documentElement
  const ownedBy = root ? createOwnershipMap(root) : new Map<Element, Element>()
  let nextRef = 1

  if (root) {
    visitElement(root, 0, false)
  }

  return { ariaSnapshot: lines.join('\n'), ref: refs.get(args.target) }

  function visitElement(element: Element, depth: number, suppressText: boolean): void {
    if (visited.has(element) || isExcluded(element) || isInaccessible(element)) {
      return
    }

    visited.add(element)
    const role = args.api.getRole(element)
    const renderedRole = role && role !== 'none' && role !== 'presentation' ? role : undefined
    const name = renderedRole ? normalize(args.api.computeAccessibleName(element)) : ''
    const currentDepth = renderedRole ? depth + 1 : depth
    const suppressDescendantText = isTextRepresentedByName(renderedRole, name) || (!renderedRole && suppressText)

    if (renderedRole) {
      const ref = `e${nextRef}`

      nextRef += 1
      refs.set(element, ref)
      lines.push(`${'  '.repeat(depth)}- ${renderedRole}${name ? ` ${JSON.stringify(name)}` : ''} [ref=${ref}]${renderProperties(element, renderedRole)}`)
    }

    for (const child of getComposedChildren(element)) {
      if (child instanceof Element) {
        visitElement(child, currentDepth, suppressDescendantText)
      } else if (child.nodeType === Node.TEXT_NODE && !suppressDescendantText) {
        const text = normalize(child.textContent ?? '')

        if (text) {
          lines.push(`${'  '.repeat(currentDepth)}- text ${JSON.stringify(text)}`)
        }
      }
    }
  }

  function getComposedChildren(element: Element): Node[] {
    const shadowRoot = args.getShadowRoot(element)
    let children: Node[]

    if (shadowRoot) {
      children = getRootChildren(shadowRoot)
    } else if (element instanceof HTMLSlotElement) {
      const assignedNodes = element.assignedNodes({ flatten: true })

      children = assignedNodes.length ? assignedNodes : [...element.childNodes]
    } else {
      children = [...element.childNodes]
    }

    const naturallyOwnedChildren = children.filter(child => !(child instanceof Element) || !ownedBy.has(child) || ownedBy.get(child) === element)
    const ariaOwnedChildren = [...ownedBy.entries()].filter(([, owner]) => owner === element).map(([owned]) => owned)

    return [...naturallyOwnedChildren, ...ariaOwnedChildren]
  }

  function getRootChildren(rootValue: ShadowRoot): Node[] {
    return [...rootValue.childNodes].flatMap(child => (child instanceof HTMLSlotElement ? getComposedChildren(child) : [child]))
  }

  function isExcluded(element: Element): boolean {
    return element.hasAttribute(args.recorderUiAttribute) || Boolean(element.closest(`[${args.recorderUiAttribute}]`))
  }

  function createOwnershipMap(rootElement: Element): Map<Element, Element> {
    const result = new Map<Element, Element>()
    const elements: Element[] = []
    const collected = new Set<Element>()

    collect(rootElement)
    for (const owner of elements) {
      const idRoot = owner.getRootNode() as Document | ShadowRoot

      for (const id of owner.getAttribute('aria-owns')?.split(/\s+/).filter(Boolean) ?? []) {
        const owned = idRoot.getElementById(id)

        if (owned && owned !== owner && !result.has(owned)) {
          result.set(owned, owner)
        }
      }
    }
    return result

    function collect(element: Element): void {
      if (collected.has(element)) {
        return
      }

      collected.add(element)
      elements.push(element)
      for (const child of element.children) {
        collect(child)
      }
      for (const child of args.getShadowRoot(element)?.children ?? []) {
        collect(child)
      }
    }
  }

  function isInaccessible(element: Element): boolean {
    const cached = inaccessibleCache.get(element)

    if (cached !== undefined) {
      return cached
    }

    const inaccessible = args.api.isInaccessible(element)

    inaccessibleCache.set(element, inaccessible)
    return inaccessible
  }

  function renderProperties(element: Element, role: string): string {
    const properties: string[] = []
    const description = normalize(args.api.computeAccessibleDescription(element))
    const checked = getAriaBooleanOrMixed(element, 'aria-checked', element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type) ? (element.indeterminate ? 'mixed' : element.checked) : undefined)
    const selected = getAriaBoolean(element, 'aria-selected', element instanceof HTMLOptionElement ? element.selected : undefined)
    const expanded = getAriaBoolean(element, 'aria-expanded')
    const pressed = getAriaBooleanOrMixed(element, 'aria-pressed')
    const level = getLevel(element, role)
    const value = getValue(element, role)

    addProperty('description', description || undefined)
    addProperty('value', value)
    addProperty('level', level)
    addProperty('checked', checked)
    addProperty('selected', selected)
    addProperty('expanded', expanded)
    addProperty('pressed', pressed)
    addProperty('disabled', args.api.isDisabled(element) || undefined)
    addProperty('required', getBooleanState(element, 'required', 'aria-required'))
    addProperty('readonly', getBooleanState(element, 'readOnly', 'aria-readonly'))
    addProperty('invalid', getInvalidState(element))
    addProperty('busy', getAriaBoolean(element, 'aria-busy'))
    addProperty('current', getAriaCurrent(element))
    addProperty('orientation', element.getAttribute('aria-orientation') || undefined)

    return properties.length ? ` ${properties.join(' ')}` : ''

    function addProperty(name: string, valueToAdd: boolean | number | string | undefined): void {
      if (valueToAdd === undefined) {
        return
      }

      properties.push(valueToAdd === true ? `[${name}]` : `[${name}=${typeof valueToAdd === 'string' ? JSON.stringify(valueToAdd) : valueToAdd}]`)
    }
  }

  function getValue(element: Element, role: string): number | string | undefined {
    const ariaValueText = element.getAttribute('aria-valuetext')
    const ariaValueNow = element.getAttribute('aria-valuenow')

    if (ariaValueText !== null) {
      return normalize(ariaValueText)
    }
    if (ariaValueNow !== null && ariaValueNow.trim()) {
      const numericValue = Number(ariaValueNow)

      return Number.isFinite(numericValue) ? numericValue : ariaValueNow
    }
    if (element instanceof HTMLSelectElement) {
      return [...element.selectedOptions]
        .map(option => normalize(option.textContent ?? option.value))
        .filter(Boolean)
        .join(', ')
    }
    if (element instanceof HTMLTextAreaElement) {
      return element.value
    }
    if (element instanceof HTMLInputElement && !['button', 'checkbox', 'file', 'hidden', 'image', 'password', 'radio', 'reset', 'submit'].includes(element.type)) {
      return element.value
    }
    if (role === 'progressbar' && element instanceof HTMLProgressElement) {
      return element.value
    }
    if (role === 'meter' && element instanceof HTMLMeterElement) {
      return element.value
    }
    return undefined
  }

  function getLevel(element: Element, role: string): number | undefined {
    if (role !== 'heading') {
      return undefined
    }

    const ariaLevel = Number(element.getAttribute('aria-level'))
    const tagLevel = /^H([1-6])$/.exec(element.tagName)?.[1]

    return Number.isInteger(ariaLevel) && ariaLevel > 0 ? ariaLevel : tagLevel ? Number(tagLevel) : undefined
  }

  function getBooleanState(element: Element, propertyName: 'readOnly' | 'required', ariaName: 'aria-readonly' | 'aria-required'): boolean | undefined {
    return getAriaBoolean(element, ariaName, propertyName in element ? Boolean((element as unknown as Record<string, unknown>)[propertyName]) : undefined)
  }

  function getInvalidState(element: Element): boolean | string | undefined {
    const value = element.getAttribute('aria-invalid')

    if (value === null || value === 'false') {
      return 'validity' in element && !(element as HTMLInputElement).validity.valid ? true : undefined
    }
    return value === 'true' ? true : value
  }

  function getAriaCurrent(element: Element): boolean | string | undefined {
    const value = element.getAttribute('aria-current')

    return value === null || value === 'false' ? undefined : value === 'true' ? true : value
  }

  function getAriaBoolean(element: Element, name: string, nativeValue?: boolean): boolean | undefined {
    const value = element.getAttribute(name)

    return value === 'true' ? true : value === 'false' ? false : nativeValue
  }

  function getAriaBooleanOrMixed(element: Element, name: string, nativeValue?: boolean | 'mixed'): boolean | 'mixed' | undefined {
    const value = element.getAttribute(name)

    return value === 'mixed' ? 'mixed' : value === 'true' ? true : value === 'false' ? false : nativeValue
  }

  function isTextRepresentedByName(role: string | undefined, name: string): boolean {
    return Boolean(name && role && ['button', 'checkbox', 'columnheader', 'heading', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'rowheader', 'switch', 'tab', 'treeitem'].includes(role))
  }

  function normalize(value: string): string {
    return value.replace(/\s+/g, ' ').trim()
  }
}

interface CapturedAriaSnapshot {
  ariaSnapshot: string
  ref?: string
}

interface GenerateAriaSnapshotArgs {
  api: DomAccessibilityApi
  getShadowRoot: (element: Element) => ShadowRoot | null
  recorderUiAttribute: string
  target: Element
}
