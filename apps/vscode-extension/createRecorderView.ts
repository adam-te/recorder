import { window, type Disposable } from 'vscode'

export { createRecorderView }

function createRecorderView(): Disposable {
  return window.registerTreeDataProvider('thousandeyesRecorder.controls', {
    getChildren: () => [],
    getTreeItem: item => item,
  })
}
