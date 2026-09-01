# ARIA Utilities

Generates compact, Playwright-compatible accessibility snapshots and unique semantic locator candidates for recorder browser bundles. Snapshot generation also identifies the nearest relevant ARIA node for the captured target.

## Entry points

- `@te/aria` exports portable snapshot and locator types plus snapshot rendering.
- `@te/aria/browser` exports DOM-dependent snapshot capture and locator generation.

## Vendored Playwright sources

The implementation uses committed Playwright accessibility and selector sources pinned to the package's Playwright version. Runtime consumers do not require network access.

From the repository root, refresh the vendored sources and generated browser runtime with:

```text
npm run generate:aria
```
