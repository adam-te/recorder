# Playwright Codec

Generates a Playwright Test TypeScript module from a recorder document. The generated test follows the recorded action stream exactly; `startUrl` and action `pageUrl` values remain metadata and do not add navigation steps.

Plain-text values are embedded as TypeScript string literals. Secret values are read from environment variables at runtime and produce a clear error when the named variable is missing.

`formatPlaywrightLocator` is the shared locator-code formatter used by generated scripts and recorder interfaces. It emits locators rooted at `page` by default and supports an implicit scope for tooltip-style presentation.
