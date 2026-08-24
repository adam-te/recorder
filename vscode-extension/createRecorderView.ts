import { window, type Disposable, type TreeDataProvider } from 'vscode'

export { createRecorderView }

function createRecorderView(): Disposable {
  const treeDataProvider: TreeDataProvider<never> = {
    getChildren: () => [],
    getTreeItem: item => item,
  }

  return window.registerTreeDataProvider('thousandeyesRecorder.controls', treeDataProvider)
}
