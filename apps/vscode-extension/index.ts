import type { ExtensionContext } from 'vscode'

import { activateExtension, type ActiveExtension } from './activateExtension.ts'

export { activate, deactivate }

let activeExtension: ActiveExtension | undefined

function activate(context: ExtensionContext): void {
  activeExtension = activateExtension({ context })
}

async function deactivate(): Promise<void> {
  await activeExtension?.dispose()
  activeExtension = undefined
}
