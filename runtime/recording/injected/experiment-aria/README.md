# Experimental ARIA locator generation

This removable experiment generates and validates role/name and label locator chains entirely inside the recorded page. `dom-accessibility-api` is the sole source of implicit roles and accessible names.

Run `npm run generate:experiment-aria --workspace @te/recorder-runtime` after changing the dependency version. The generated source includes the dependency's MIT attribution and is injected before the recorder function.
