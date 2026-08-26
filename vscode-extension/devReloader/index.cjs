const path = require('node:path')
const { commands, RelativePattern, workspace } = require('vscode')

module.exports = { activate }

function activate(context) {
  const bundlePath = process.env.RECORDER_EXTENSION_BUNDLE
  if (!bundlePath) {
    throw new Error('RECORDER_EXTENSION_BUNDLE must identify the extension bundle to reload.')
  }

  const bundleWatcher = workspace.createFileSystemWatcher(new RelativePattern(path.dirname(bundlePath), path.basename(bundlePath)))

  context.subscriptions.push(
    bundleWatcher,
    bundleWatcher.onDidChange(() => void commands.executeCommand('workbench.action.restartExtensionHost')),
  )
}
