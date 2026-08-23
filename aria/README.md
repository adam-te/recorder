# ARIA browser utilities

Browser-side utilities for generating Playwright-compatible AI ARIA snapshots and semantic locator candidates. The snapshot implementation uses vendored TypeScript sources from the Playwright version declared by this package's `playwright` development dependency; the locator candidate implementation remains local.

Run `npm run generate:aria` in this workspace to refresh the committed Playwright sources, or run the command with the same name at the repository root to refresh both the sources and downstream injected runtime. The generator downloads the pinned Apache-2.0 Playwright sources and verifies that every consumer uses the same version. Runtime consumers do not need network access.

The locator generator accepts callbacks for excluding application-owned elements and traversing closed shadow roots. The upstream Playwright snapshot generator accepts only the target element and traverses open shadow roots. The `@te/aria/browser` entry point is available to consumers that want to create a browser bundle.
