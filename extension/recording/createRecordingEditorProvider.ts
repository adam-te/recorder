import { randomUUID } from 'node:crypto'
import { commands, env, Uri, ViewColumn, window, workspace, type CustomTextEditorProvider, type Disposable, type ExtensionContext, type TextDocument, type WebviewPanel } from 'vscode'

import { getRecordingSnapshotFileName, parseRecordingDocument, parseRecordingSnapshot, type RecordingDocument } from '@te/recorder-core'
import type { RecordingEditorUiMessage } from '@te/recorder-ui/recording-editor'
import { renderRecordingSnapshot } from '@te/recorder-ui/render-recording-snapshot'

export { createRecordingEditorProvider, recordingEditorViewType }

const recordingEditorViewType = 'thousandeyesRecorder.recording'
const decoder = new TextDecoder()

function createRecordingEditorProvider(args: CreateRecordingEditorProviderArgs): Disposable {
  const provider: CustomTextEditorProvider = {
    resolveCustomTextEditor: (document, panel) => resolveRecordingEditor({ ...args, document, panel }),
  }

  return window.registerCustomEditorProvider(recordingEditorViewType, provider, { supportsMultipleEditorsPerDocument: false, webviewOptions: { retainContextWhenHidden: true } })
}

function resolveRecordingEditor(args: ResolveRecordingEditorArgs): void {
  const mediaDirectory = Uri.joinPath(args.context.extensionUri, 'media')
  const nonce = randomUUID()
  let selectedActionIndex = 0
  let decisionInProgress = false
  let disposed = false

  args.panel.webview.options = { enableScripts: true, localResourceRoots: [mediaDirectory] }
  args.panel.webview.html = getEditorHtml({ nonce, scriptUri: args.panel.webview.asWebviewUri(Uri.joinPath(mediaDirectory, 'recordingEditor.js')), styleUri: args.panel.webview.asWebviewUri(Uri.joinPath(mediaDirectory, 'recordingEditor.css')), webviewSource: args.panel.webview.cspSource })

  const disposables = [
    args.panel.webview.onDidReceiveMessage(handleMessage),
    workspace.onDidChangeTextDocument(event => {
      if (event.document === args.document) {
        void publishDocument()
      }
    }),
  ]
  args.panel.onDidDispose(() => {
    disposed = true
    disposables.forEach(disposable => disposable.dispose())
    if (!decisionInProgress && args.isPending(args.document.uri)) {
      void handleClosedDraft()
    }
  })

  async function handleMessage(message: RecordingEditorUiMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        await publishDocument()
        break
      case 'selectAction':
        selectedActionIndex = message.actionIndex
        await publishSnapshot()
        break
      case 'copy':
        await env.clipboard.writeText(message.text)
        break
      case 'openJson':
        await commands.executeCommand('vscode.openWith', args.document.uri, 'default', ViewColumn.Beside)
        break
      case 'play':
        await withErrorMessage(async () => args.onPlay(readDocument()))
        break
      case 'save': {
        if (decisionInProgress) break
        decisionInProgress = true
        let savedDocumentUri: Uri | undefined
        await withErrorMessage(async () => {
          savedDocumentUri = await args.onSave(args.document.uri)
        })
        decisionInProgress = false
        if (savedDocumentUri) {
          args.panel.dispose()
          await commands.executeCommand('vscode.openWith', savedDocumentUri, recordingEditorViewType)
        } else if (disposed) {
          await handleClosedDraft()
        } else {
          await args.panel.webview.postMessage({ type: 'decisionCancelled' })
        }
        break
      }
      case 'discard':
        if (decisionInProgress) break
        decisionInProgress = true
        if (await args.onDiscard(args.document.uri)) args.panel.dispose()
        decisionInProgress = false
        break
    }
  }

  async function publishDocument(): Promise<void> {
    await withErrorMessage(async () => {
      const document = readDocument()
      selectedActionIndex = Math.min(selectedActionIndex, Math.max(0, document.actions.length - 1))
      await args.panel.webview.postMessage({ type: 'document', document, pending: args.isPending(args.document.uri), selectedActionIndex })
      await publishSnapshot(document)
    }, true)
  }

  async function publishSnapshot(document = readDocument()): Promise<void> {
    const action = document.actions[selectedActionIndex]
    if (!action || !('locatorCandidates' in action)) {
      await args.panel.webview.postMessage({ type: 'snapshot', actionIndex: selectedActionIndex })
      return
    }

    try {
      const snapshotUri = Uri.joinPath(args.document.uri, '..', 'snapshots', getRecordingSnapshotFileName(selectedActionIndex))
      const contents = await workspace.fs.readFile(snapshotUri)
      const snapshot = parseRecordingSnapshot(JSON.parse(decoder.decode(contents)))
      await args.panel.webview.postMessage({ type: 'snapshot', actionIndex: selectedActionIndex, ...renderRecordingSnapshot(snapshot) })
    } catch (error) {
      await args.panel.webview.postMessage({ type: 'snapshot', actionIndex: selectedActionIndex, error: getErrorMessage(error) })
    }
  }

  async function handleClosedDraft(): Promise<void> {
    const draftDirectory = Uri.joinPath(args.document.uri, '..')
    const relativePath = workspace.asRelativePath(draftDirectory, false)
    const action = await window.showWarningMessage(`Recording was not saved. The draft was retained at ${relativePath}.`, 'Save Recording', 'Reopen Draft')

    try {
      if (action === 'Save Recording') {
        const savedDocumentUri = await args.onSave(args.document.uri)
        if (savedDocumentUri) await commands.executeCommand('vscode.openWith', savedDocumentUri, recordingEditorViewType)
      } else if (action === 'Reopen Draft') {
        await commands.executeCommand('vscode.openWith', args.document.uri, recordingEditorViewType)
      }
    } catch (error) {
      await window.showErrorMessage(getErrorMessage(error))
    }
  }

  function readDocument(): RecordingDocument {
    return parseRecordingDocument(JSON.parse(args.document.getText()))
  }

  async function withErrorMessage(operation: () => Promise<void>, publish = false): Promise<void> {
    try {
      await operation()
    } catch (error) {
      const message = getErrorMessage(error)
      if (publish) {
        await args.panel.webview.postMessage({ type: 'error', message })
      } else {
        await window.showErrorMessage(message)
      }
    }
  }
}

function getEditorHtml(args: { nonce: string; scriptUri: Uri; styleUri: Uri; webviewSource: string }): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${args.webviewSource}; script-src 'nonce-${args.nonce}';">
    <link rel="stylesheet" href="${args.styleUri}">
    <title>Transaction Recording</title>
  </head>
  <body>
    <main id="app" aria-live="polite"></main>
    <script nonce="${args.nonce}" src="${args.scriptUri}"></script>
  </body>
</html>`
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface CreateRecordingEditorProviderArgs {
  context: ExtensionContext
  isPending: (documentUri: Uri) => boolean
  onDiscard: (documentUri: Uri) => Promise<boolean>
  onPlay: (document?: RecordingDocument) => Promise<void>
  onSave: (documentUri: Uri) => Promise<Uri | undefined>
}

interface ResolveRecordingEditorArgs extends CreateRecordingEditorProviderArgs {
  document: TextDocument
  panel: WebviewPanel
}
