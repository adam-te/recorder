# ARIA browser utilities

Browser-side utilities for generating Playwright-compatible AI ARIA snapshots and semantic locator candidates. Snapshots are compact JSON-safe tree DTOs that retain semantic content, refs, and the pointer-cursor hint while omitting empty leaf `children`; `renderAriaSnapshot` reconstructs Playwright's AI-mode YAML from a stored tree.

Both features use vendored TypeScript accessibility and selector utilities from the Playwright version declared by this package's `playwright` development dependency; the locator candidate selection algorithm remains local. The snapshot generator accepts the event's element-only composed path so it can select the nearest ARIA-visible, non-generic ancestor with a Playwright ref at capture time; recording consumers store that `targetRef` on the interaction or action rather than in the tree.

Run `npm run generate:aria` in this workspace to refresh the committed Playwright sources, or run the command with the same name at the repository root to refresh both the sources and downstream injected runtime. The generator downloads the pinned Apache-2.0 Playwright sources and verifies that every consumer uses the same version. Runtime consumers do not need network access.

The locator generator accepts callbacks for excluding application-owned elements and traversing closed shadow roots. The snapshot tree follows Playwright's open-shadow-root traversal; the `@te/aria/browser` entry point is available to consumers that want to create a browser bundle.
