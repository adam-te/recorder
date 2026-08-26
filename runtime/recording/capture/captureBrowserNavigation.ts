import type { Frame, Page } from 'playwright'

export { captureBrowserNavigation }
export type { BrowserNavigationCapture, CapturedBrowserNavigation }

/** Observes top-level browser navigation while a recording is active. */
async function captureBrowserNavigation(args: CaptureBrowserNavigationArgs): Promise<BrowserNavigationCapture> {
  const cdpSession = await args.page.context().newCDPSession(args.page)
  await cdpSession.send('Page.enable')
  const frameTree = await cdpSession.send('Page.getFrameTree')
  let history = await cdpSession.send('Page.getNavigationHistory')
  let rendererNavigationRequested = false
  let pendingCapture = Promise.resolve()

  cdpSession.on('Page.frameRequestedNavigation', event => {
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
  }

  async function captureNavigation(rendererInitiated: boolean): Promise<void> {
    const nextHistory = await cdpSession.send('Page.getNavigationHistory')
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
    await flush()
    await cdpSession.detach()
  }

  async function flush(): Promise<void> {
    await pendingCapture
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
