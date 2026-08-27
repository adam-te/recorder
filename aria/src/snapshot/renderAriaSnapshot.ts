import { renderAriaTree, type AriaSnapshot as PlaywrightAriaSnapshot } from '../../vendor/playwright/injected/ariaSnapshot.ts'
import type { AriaNode as PlaywrightAriaNode } from '../../vendor/playwright/isomorphic/ariaSnapshot.ts'
import type { AriaNode } from '../types/snapshot.ts'

export { renderAriaSnapshot }

function renderAriaSnapshot(snapshot: RenderableAriaNode): string {
  return renderAriaTree({ iframeRefs: [], info: new Map(), refs: new Map(), root: toPlaywrightAriaNode(snapshot) } satisfies PlaywrightAriaSnapshot, { mode: 'ai' }).text
}

function toPlaywrightAriaNode(node: RenderableAriaNode): PlaywrightAriaNode {
  const { cursor, role, ...playwrightNode } = node

  return {
    ...playwrightNode,
    box: { cursor, inline: false, visible: true },
    children: (node.children ?? []).map(child => (typeof child === 'string' ? child : toPlaywrightAriaNode(child))),
    receivesPointerEvents: true,
    role: role as PlaywrightAriaNode['role'],
  }
}

interface RenderableAriaNode extends Omit<AriaNode, 'children' | 'role'> {
  children?: (RenderableAriaNode | string)[]
  role: string
}
