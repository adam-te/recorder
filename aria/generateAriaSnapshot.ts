import type { AriaSnapshot, AriaSnapshotOptions } from './types.ts'
import { generateAriaTree, renderAriaTree } from './vendor/playwright/injected/ariaSnapshot.ts'

export { generateAriaSnapshot }

function generateAriaSnapshot(options: AriaSnapshotOptions): AriaSnapshot {
  const root = options.target.ownerDocument.body ?? options.target.ownerDocument.documentElement

  if (!root) {
    return { snapshot: '' }
  }

  const treeOptions = { mode: 'ai' } as const
  const tree = generateAriaTree(root, treeOptions)

  return { snapshot: renderAriaTree(tree, treeOptions).text, targetRef: tree.refs.get(options.target) }
}
