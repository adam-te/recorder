import type { Protocol } from 'devtools-protocol'
import type { Frame, Page } from 'playwright'

export { captureBrowserNavigation }
export type { BrowserNavigationCapture, CapturedBrowserNavigation }

/** Observes top-level browser navigation while a recording is active. */
async function captureBrowserNavigation(args: CaptureBrowserNavigationArgs): Promise<BrowserNavigationCapture> {
  const navigationSession = await args.page.context().newCDPSession(args.page)
  await navigationSession.send('Page.enable')
  const frameTree = await navigationSession.send('Page.getFrameTree')
  let history = await readNavigationHistory()
  let rendererNavigationRequested = false
  let pendingCapture = Promise.resolve()

  navigationSession.on('Page.frameRequestedNavigation', event => {
    if (event.frameId !== frameTree.frameTree.frame.id) return
    rendererNavigationRequested = true
  })
  args.page.on('framenavigated', queueNavigationCapture)

  return { dispose, flush }

  function queueNavigationCapture(frame: Frame): void {
    if (frame !== args.page.mainFrame()) return

    const rendererInitiated = rendererNavigationRequested

    rendererNavigationRequested = false
    pendingCapture = pendingCapture.then(() => captureNavigation(rendererInitiated))
    void pendingCapture.catch(() => undefined)
  }

  async function captureNavigation(rendererInitiated: boolean): Promise<void> {
    const nextHistory = await readNavigationHistory()
    const previousEntry = history.entries[history.currentIndex]
    const currentEntry = nextHistory.entries[nextHistory.currentIndex]
    if (!rendererInitiated && previousEntry && currentEntry) {
      const previousEntryIndex = history.entries.findIndex(entry => entry.id === currentEntry.id)

      if (previousEntryIndex === -1) {
        await args.onNavigation?.({ pageUrl: previousEntry.url, url: currentEntry.userTypedURL || currentEntry.url })
      }
    }

    history = nextHistory
  }

  async function dispose(): Promise<void> {
    args.page.off('framenavigated', queueNavigationCapture)
    try {
      await flush()
    } finally {
      await navigationSession.detach()
    }
  }

  async function flush(): Promise<void> {
    await pendingCapture
  }

  async function readNavigationHistory(attemptsRemaining = 3): Promise<Protocol.Page.GetNavigationHistoryResponse> {
    const historySession = await args.page.context().newCDPSession(args.page)

    try {
      return await historySession.send('Page.getNavigationHistory')
    } catch (error) {
      if (attemptsRemaining <= 1 || !error.message.includes('Not attached to an active page')) throw error
    } finally {
      await historySession.detach()
    }

    await new Promise<void>(resolve => setTimeout(resolve))
    return readNavigationHistory(attemptsRemaining - 1)
  }
}

interface CaptureBrowserNavigationArgs {
  onNavigation?: (navigation: CapturedBrowserNavigation) => Promise<void> | void
  page: Page
}

interface CapturedBrowserNavigation {
  pageUrl: string
  url: string
}

interface BrowserNavigationCapture {
  dispose: () => Promise<void>
  flush: () => Promise<void>
}
