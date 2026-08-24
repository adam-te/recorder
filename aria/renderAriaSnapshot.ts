import { PLAYWRIGHT_VERSION } from './playwrightVersion.ts'
import type { AriaSnapshot } from './types.ts'
import { renderAriaTree, type AriaSnapshot as PlaywrightAriaSnapshot } from './vendor/playwright/injected/ariaSnapshot.ts'

export { renderAriaSnapshot }

function renderAriaSnapshot(snapshot: AriaSnapshot): string {
  if (snapshot.schemaVersion !== 1) {
    throw new Error(`Unsupported ARIA snapshot schema version: ${String(snapshot.schemaVersion)}`)
  }
  if (snapshot.playwrightVersion !== PLAYWRIGHT_VERSION) {
    throw new Error(`Cannot render a Playwright ${snapshot.playwrightVersion} ARIA snapshot with Playwright ${PLAYWRIGHT_VERSION}`)
  }

  const tree: PlaywrightAriaSnapshot = { elements: new Map(), iframeRefs: [], refs: new Map(), root: snapshot.root }

  return renderAriaTree(tree, { mode: 'ai' }).text
}
