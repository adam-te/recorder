import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'

import { tryTo } from '@te/recorder-utils'

export { createBrowserSession }
export type { BrowserSession }

async function createBrowserSession(args: CreateBrowserSessionArgs = {}): Promise<BrowserSession> {
  const browser = await chromium.launch({ headless: args.headless ?? false })
  const context = await browser.newContext()
  const page = await context.newPage()

  if (args.url) {
    await page.goto(args.url)
  }

  return { browser, close, context, page }

  async function close(): Promise<void> {
    await tryTo(
      () => context.close(),
      undefined,
      () => browser.close(),
    )
  }
}

interface CreateBrowserSessionArgs {
  headless?: boolean
  url?: string
}

interface BrowserSession {
  browser: Browser
  close: () => Promise<void>
  context: BrowserContext
  page: Page
}
