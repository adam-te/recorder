import type { Protocol } from 'devtools-protocol'
import type { Page } from 'playwright'

import { tryTo } from '@te/recorder-utils'

export { captureBrowserNavigation }
export type { BrowserNavigationCapture, CapturedBrowserNavigation }

/** Observes top-level browser navigation from the Playwright host process. */
async function captureBrowserNavigation(args: CaptureBrowserNavigationArgs): Promise<BrowserNavigationCapture> {
  const navigationSession = await args.page.context().newCDPSession(args.page)
  await navigationSession.send('Page.enable')
  const frameTree = await navigationSession.send('Page.getFrameTree')
  const mainFrameId = frameTree.frameTree.frame.id
  const navigationClassifications = new Map<Protocol.Network.LoaderId, CapturedBrowserNavigation | false>()
  const rendererNavigationRequests: Protocol.Page.FrameRequestedNavigationEvent[] = []
  let committedLoaderId = frameTree.frameTree.frame.loaderId
  let committedUrl = frameTree.frameTree.frame.url
  let pendingCapture = Promise.resolve()

  navigationSession.on('Page.frameRequestedNavigation', event => {
    if (event.frameId !== mainFrameId) return
    rendererNavigationRequests.push(event)
  })
  navigationSession.on('Page.frameStartedNavigating', classifyNavigation)
  navigationSession.on('Page.frameNavigated', event => {
    if (event.frame.id !== mainFrameId) return
    committedLoaderId = event.frame.loaderId
    commitNavigation(event.frame.loaderId, event.frame.url)
  })
  navigationSession.on('Page.navigatedWithinDocument', event => {
    if (event.frameId !== mainFrameId) return
    commitNavigation(committedLoaderId, event.url)
  })

  return { dispose, flush }

  function classifyNavigation(event: Protocol.Page.FrameStartedNavigatingEvent): void {
    if (event.frameId !== mainFrameId || navigationClassifications.has(event.loaderId)) return

    if (rendererNavigationRequests.shift() || (event.navigationType !== 'differentDocument' && event.navigationType !== 'sameDocument')) {
      navigationClassifications.set(event.loaderId, false)
      return
    }

    navigationClassifications.set(event.loaderId, { pageUrl: committedUrl, url: event.url })
  }

  function commitNavigation(loaderId: Protocol.Network.LoaderId, url: string): void {
    const navigation = navigationClassifications.get(loaderId)

    navigationClassifications.delete(loaderId)
    committedUrl = url
    if (!navigation) return
    pendingCapture = pendingCapture.then(() => args.onNavigation?.(navigation))
    void pendingCapture.catch(() => undefined)
  }

  async function dispose(): Promise<void> {
    await tryTo(flush, undefined, () => navigationSession.detach())
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
