import type { AriaSnapshot } from './types.ts'
import { renderAriaTree, type AriaSnapshot as PlaywrightAriaSnapshot } from './vendor/playwright/injected/ariaSnapshot.ts'

export { renderAriaSnapshot }

function renderAriaSnapshot(snapshot: AriaSnapshot): string {
  const tree: PlaywrightAriaSnapshot = { elements: new Map(), iframeRefs: [], refs: new Map(), root: snapshot }

  return renderAriaTree(tree, { mode: 'ai' }).text
}
