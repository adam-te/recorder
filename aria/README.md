# ARIA browser utilities

Generic browser-side utilities for serializing the accessible tree and generating semantic locator candidates. The package has no dependency on the recorder, Playwright, or its recording document format.

Both operations accept optional callbacks for excluding application-owned elements and traversing closed shadow roots. The `@te/aria/browser` entry point is available to consumers that want to create a browser bundle.
