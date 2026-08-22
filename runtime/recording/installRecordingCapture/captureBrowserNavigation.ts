import type { Frame, Page } from 'playwright'

import type { RecordingDocument, RecordingSession } from '@te/recorder-core'

export { captureBrowserNavigation }
export type { BrowserNavigationCapture }

async function captureBrowserNavigation(args: CaptureBrowserNavigationArgs): Promise<BrowserNavigationCapture> {
  const cdpSession = await args.page.context().newCDPSession(args.page)
  await cdpSession.send('Page.enable')
  const frameTree = await cdpSession.send('Page.getFrameTree')
  let history = await cdpSession.send('Page.getNavigationHistory')
  let rendererNavigationRequested = false
  let pendingCapture = Promise.resolve()

  cdpSession.on('Page.frameRequestedNavigation', event => {
    if (event.frameId === frameTree.frameTree.frame.id) {
      rendererNavigationRequested = true
    }
  })
  args.page.on('framenavigated', queueNavigationCapture)

  return { dispose, flush }

  function queueNavigationCapture(frame: Frame): void {
    if (frame === args.page.mainFrame()) {
      const rendererInitiated = rendererNavigationRequested

      rendererNavigationRequested = false
      pendingCapture = pendingCapture.then(() => captureNavigation(rendererInitiated))
    }
  }

  async function captureNavigation(rendererInitiated: boolean): Promise<void> {
    const nextHistory = await cdpSession.send('Page.getNavigationHistory')
    const previousEntry = history.entries[history.currentIndex]
    const currentEntry = nextHistory.entries[nextHistory.currentIndex]
    if (!rendererInitiated && previousEntry && currentEntry) {
      const previousEntryIndex = history.entries.findIndex(entry => entry.id === currentEntry.id)

      if (previousEntryIndex === -1) {
        const document = args.recordingSession.append({ kind: 'goto', pageUrl: previousEntry.url, url: currentEntry.userTypedURL || currentEntry.url })

        await args.onDocumentChanged?.(document)
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
  onDocumentChanged?: (document: RecordingDocument) => Promise<void> | void
  page: Page
  recordingSession: RecordingSession
}

interface BrowserNavigationCapture {
  dispose: () => Promise<void>
  flush: () => Promise<void>
}
