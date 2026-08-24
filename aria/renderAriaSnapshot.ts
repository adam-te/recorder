import type { AriaNode, AriaSnapshot } from './types.ts'
import { renderAriaTree, type AriaSnapshot as PlaywrightAriaSnapshot } from './vendor/playwright/injected/ariaSnapshot.ts'
import type { AriaNode as PlaywrightAriaNode } from './vendor/playwright/isomorphic/ariaSnapshot.ts'

export { renderAriaSnapshot }

function renderAriaSnapshot(snapshot: AriaSnapshot): string {
  const tree: PlaywrightAriaSnapshot = { iframeRefs: [], info: new Map(), refs: new Map(), root: toPlaywrightAriaNode(snapshot) }

  return renderAriaTree(tree, { mode: 'ai' }).text
}

function toPlaywrightAriaNode(node: AriaNode): PlaywrightAriaNode {
  const { cursor, ...playwrightNode } = node

  return {
    ...playwrightNode,
    box: { cursor, inline: false, visible: true },
    children: (node.children ?? []).map(child => (typeof child === 'string' ? child : toPlaywrightAriaNode(child))),
    receivesPointerEvents: true,
  }
}
