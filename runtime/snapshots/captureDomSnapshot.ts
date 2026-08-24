import type { Protocol } from 'devtools-protocol'
import type { Page } from 'playwright'

import { tryTo } from '@te/recorder-utils'

export { captureDomSnapshot }
export type { CapturedDomSnapshot }

/** Captures the current page DOM through the Chromium DevTools Protocol. */
async function captureDomSnapshot(page: Page): Promise<CapturedDomSnapshot> {
  const client = await page.context().newCDPSession(page)
  const capturedAt = new Date().toISOString()
  const pageUrl = page.url()

  return await tryTo(
    async () => ({
      capturedAt,
      pageUrl,
      snapshot: await client.send('DOMSnapshot.captureSnapshot', {
        computedStyles: [],
        includeDOMRects: false,
        includePaintOrder: false,
      }),
      version: 1,
    }),
    undefined,
    () => client.detach(),
  )
}

interface CapturedDomSnapshot {
  capturedAt: string
  pageUrl: string
  snapshot: Protocol.DOMSnapshot.CaptureSnapshotResponse
  version: 1
}
