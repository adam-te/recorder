import type { AriaNode, AriaSnapshotOptions, GeneratedAriaSnapshot } from './types.ts'
import { generateAriaTree } from './vendor/playwright/injected/ariaSnapshot.ts'
import { beginAriaCaches, endAriaCaches, isElementHiddenForAria } from './vendor/playwright/injected/roleUtils.ts'
import type { AriaNode as PlaywrightAriaNode } from './vendor/playwright/isomorphic/ariaSnapshot.ts'

export { generateAriaSnapshot }

function generateAriaSnapshot(options: AriaSnapshotOptions): GeneratedAriaSnapshot {
  const root = options.target.ownerDocument.body ?? options.target.ownerDocument.documentElement

  if (!root) {
    throw new Error('Unable to capture an ARIA snapshot without a document root.')
  }

  const treeOptions = { mode: 'ai' } as const
  const tree = generateAriaTree(root, treeOptions)
  const { nodesByRef, root: annotatedRoot } = annotateAriaVisibility(tree.root)
  const targetRef = findTargetRef(nodesByRef, tree.refs, options.targetPath ?? elementAncestry(options.target))

  return {
    snapshot: annotatedRoot,
    ...(targetRef ? { targetRef } : {}),
  }
}

function annotateAriaVisibility(root: PlaywrightAriaNode): { nodesByRef: Map<string, AriaNode>; root: AriaNode } {
  const nodesByRef = new Map<string, AriaNode>()

  beginAriaCaches()
  try {
    return { nodesByRef, root: visit(root) }
  } finally {
    endAriaCaches()
  }

  function visit(node: PlaywrightAriaNode): AriaNode {
    const element = ariaNodeElement(node)
    const result: AriaNode = {
      ariaVisible: !isElementHiddenForAria(element),
      box: {
        inline: node.box.inline,
        visible: node.box.visible,
        ...(node.box.cursor !== undefined ? { cursor: node.box.cursor } : {}),
      },
      children: node.children.map(child => (typeof child === 'string' ? child : visit(child))),
      name: node.name,
      props: { ...node.props },
      receivesPointerEvents: node.receivesPointerEvents,
      role: node.role,
      ...(node.active !== undefined ? { active: node.active } : {}),
      ...(node.checked !== undefined ? { checked: node.checked } : {}),
      ...(node.disabled !== undefined ? { disabled: node.disabled } : {}),
      ...(node.expanded !== undefined ? { expanded: node.expanded } : {}),
      ...(node.level !== undefined ? { level: node.level } : {}),
      ...(node.pressed !== undefined ? { pressed: node.pressed } : {}),
      ...(node.ref !== undefined ? { ref: node.ref } : {}),
      ...(node.selected !== undefined ? { selected: node.selected } : {}),
    }

    if (result.ref) {
      nodesByRef.set(result.ref, result)
    }

    return result
  }
}

function ariaNodeElement(node: PlaywrightAriaNode): Element {
  for (const symbol of Object.getOwnPropertySymbols(node)) {
    const value = (node as unknown as Record<symbol, unknown>)[symbol]

    if (value instanceof Element) {
      return value
    }
  }

  throw new Error('Playwright did not associate an Element with an ARIA node.')
}

function elementAncestry(target: Element): Element[] {
  const result: Element[] = []
  let current: Element | undefined = target

  while (current) {
    result.push(current)
    const root = current.getRootNode()

    current = current.parentElement ?? (root instanceof ShadowRoot ? root.host : undefined)
  }
  return result
}

function findTargetRef(nodesByRef: Map<string, AriaNode>, refs: Map<Element, string>, targetPath: Element[]): string | undefined {
  for (const element of targetPath) {
    const ref = refs.get(element)
    const node = ref ? nodesByRef.get(ref) : undefined

    if (node && node.role !== 'generic' && node.ariaVisible) {
      return ref
    }
  }

  return undefined
}
