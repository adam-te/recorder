# ARIA browser utilities

Browser-side utilities for generating Playwright-compatible AI ARIA snapshots and semantic locator candidates. The snapshot implementation is generated from the Playwright version pinned in `generatePlaywrightAriaSnapshot.cjs`; the locator candidate implementation remains local.

Run `npm run generate:playwright` in this workspace to refresh the committed browser module. The generator downloads the pinned Apache-2.0 Playwright sources at development time. Runtime consumers do not need network access.

Both operations accept callbacks for excluding application-owned elements and traversing closed shadow roots. The locator generator uses both callbacks. The upstream Playwright snapshot generator currently ignores them. The `@te/aria/browser` entry point is available to consumers that want to create a browser bundle.
