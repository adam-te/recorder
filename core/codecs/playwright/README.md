# Playwright Codec

Generates a Playwright Test TypeScript module from a recorder document. The generated test follows the recorded action stream exactly; `startUrl` and action `pageUrl` values remain metadata and do not add navigation steps.

Plain-text values are embedded as TypeScript string literals. Secret values are read from environment variables at runtime and produce a clear error when the named variable is missing.

`formatPlaywrightLocator` is the shared locator-code formatter used by generated scripts and recorder interfaces. It includes the `page` receiver by default, which can be omitted for tooltip-style presentation.
