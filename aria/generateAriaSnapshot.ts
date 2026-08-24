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
  const { nodesByRef, root: snapshot } = compactAriaTree(tree.root)
  const targetRef = findTargetRef(nodesByRef, tree.refs, options.targetPath ?? elementAncestry(options.target))

  return {
    snapshot,
    ...(targetRef ? { targetRef } : {}),
  }
}

function compactAriaTree(root: PlaywrightAriaNode): { nodesByRef: Map<string, AriaNode>; root: AriaNode } {
  const nodesByRef = new Map<string, AriaNode>()

  return { nodesByRef, root: visit(root) }

  function visit(node: PlaywrightAriaNode): AriaNode {
    const result: AriaNode = {
      children: node.children.map(child => (typeof child === 'string' ? child : visit(child))),
      name: node.name,
      props: { ...node.props },
      role: node.role,
      ...(node.active ? { active: true } : {}),
      ...(node.checked ? { checked: node.checked } : {}),
      ...(node.box.cursor === 'pointer' ? { cursor: 'pointer' as const } : {}),
      ...(node.disabled ? { disabled: true } : {}),
      ...(node.expanded ? { expanded: true } : {}),
      ...(node.level !== undefined ? { level: node.level } : {}),
      ...(node.pressed ? { pressed: node.pressed } : {}),
      ...(node.ref !== undefined ? { ref: node.ref } : {}),
      ...(node.selected ? { selected: true } : {}),
    }

    if (result.ref) {
      nodesByRef.set(result.ref, result)
    }

    return result
  }
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
  beginAriaCaches()
  try {
    for (const element of targetPath) {
      const ref = refs.get(element)
      const node = ref ? nodesByRef.get(ref) : undefined

      if (node && node.role !== 'generic' && !isElementHiddenForAria(element)) {
        return ref
      }
    }
  } finally {
    endAriaCaches()
  }

  return undefined
}
