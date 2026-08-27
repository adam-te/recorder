import { randomUUID } from 'node:crypto'
import { commands, env, Uri, ViewColumn, window, workspace, type Disposable, type ExtensionContext, type TextDocument, type WebviewPanel } from 'vscode'

import { parseRecording, type Recording } from '@te/recorder-core'
import { createRecordingEditorPresenter, renderRecordingSnapshot, type RecordingEditorPresenterEvent, type RecordingEditorPresenterMessage, type RecordingEditorUiMessage } from '@te/recorder-ui/recording-editor/presenter'
import { matchBy, tryTo } from '@te/recorder-utils'

import type { RecordingDraftStore } from './createRecordingDraftStore.ts'
import { createWorkspaceRecordingArtifactStore } from './createWorkspaceRecordingArtifactStore.ts'

export { createRecordingEditorProvider, recordingEditorViewType }

const recordingEditorViewType = 'thousandeyesRecorder.recording'
function createRecordingEditorProvider(args: CreateRecordingEditorProviderArgs): Disposable {
  return window.registerCustomEditorProvider(recordingEditorViewType, { resolveCustomTextEditor: (document, panel) => resolveRecordingEditor({ ...args, document, panel }) }, { supportsMultipleEditorsPerDocument: false, webviewOptions: { retainContextWhenHidden: true } })
}

function resolveRecordingEditor(args: ResolveRecordingEditorArgs): void {
  const webviewDirectory = Uri.joinPath(args.context.extensionUri, 'dist', 'webview')
  const nonce = randomUUID()
  let decisionInProgress = false
  let disposed = false

  const presenter = createRecordingEditorPresenter({
    isPending: () => args.drafts.isDraft(args.document.uri),
    readRecording,
    readSnapshot: async actionIndex => renderRecordingSnapshot(await createWorkspaceRecordingArtifactStore(Uri.joinPath(args.document.uri, '..')).loadSnapshot(actionIndex)),
  })

  args.panel.webview.options = { enableScripts: true, localResourceRoots: [webviewDirectory] }
  args.panel.webview.html = getEditorHtml({ nonce, scriptUri: args.panel.webview.asWebviewUri(Uri.joinPath(webviewDirectory, 'recordingEditor.js')), styleUri: args.panel.webview.asWebviewUri(Uri.joinPath(webviewDirectory, 'recordingEditor.css')), webviewSource: args.panel.webview.cspSource })

  const disposables = [
    args.panel.webview.onDidReceiveMessage(handleMessage),
    workspace.onDidChangeTextDocument(event => {
      if (event.document !== args.document) return
      void publishRecording()
    }),
  ]
  args.panel.onDidDispose(() => {
    disposed = true
    disposables.forEach(disposable => disposable.dispose())
    if (decisionInProgress || !args.drafts.isDraft(args.document.uri)) return
    void handleClosedDraft()
  })

  async function handleMessage(message: RecordingEditorUiMessage): Promise<void> {
    await matchBy(message, 'type', {
      copy: async current => {
        await env.clipboard.writeText(current.text)
      },
      discard: async () => {
        if (decisionInProgress) return
        decisionInProgress = true
        if (await args.drafts.discard(args.document.uri)) args.panel.dispose()
        decisionInProgress = false
      },
      openJson: async () => {
        await commands.executeCommand('vscode.openWith', args.document.uri, 'default', ViewColumn.Beside)
      },
      play: async () => {
        await withErrorMessage(async () => args.onPlay(readRecording()))
      },
      ready: handlePresenterEvent,
      save: async () => {
        if (decisionInProgress) return
        decisionInProgress = true
        let savedDocumentUri: Uri | undefined
        await withErrorMessage(async () => {
          savedDocumentUri = await saveDraft(args.document.uri)
        })
        decisionInProgress = false
        if (savedDocumentUri) {
          args.panel.dispose()
          await commands.executeCommand('vscode.openWith', savedDocumentUri, recordingEditorViewType)
          return
        }
        if (!disposed) {
          await args.panel.webview.postMessage({ type: 'decisionCancelled' })
          return
        }
        await handleClosedDraft()
      },
      selectAction: handlePresenterEvent,
    })
  }

  async function handlePresenterEvent(message: RecordingEditorPresenterEvent): Promise<void> {
    await postMessages(message.type === 'ready' ? await presenter.ready() : await presenter.selectAction(message.actionIndex))
  }

  async function publishRecording(): Promise<void> {
    await postMessages(await presenter.publishRecording())
  }

  async function postMessages(messages: RecordingEditorPresenterMessage[]): Promise<void> {
    for (const message of messages) await args.panel.webview.postMessage(message)
  }

  async function handleClosedDraft(): Promise<void> {
    const action = await window.showWarningMessage(`Recording was not saved. The draft was retained at ${workspace.asRelativePath(Uri.joinPath(args.document.uri, '..'), false)}.`, 'Save Recording', 'Reopen Draft')

    await tryTo(
      async () => {
        if (action === 'Save Recording') {
          const savedDocumentUri = await saveDraft(args.document.uri)
          if (savedDocumentUri) await commands.executeCommand('vscode.openWith', savedDocumentUri, recordingEditorViewType)
          return
        }
        if (action !== 'Reopen Draft') return
        await commands.executeCommand('vscode.openWith', args.document.uri, recordingEditorViewType)
      },
      error => window.showErrorMessage(getErrorMessage(error)),
    )
  }

  function readRecording(): Recording {
    return parseRecording(JSON.parse(args.document.getText()))
  }

  async function saveDraft(documentUri: Uri): Promise<Uri | undefined> {
    const recording = await args.drafts.load(documentUri)
    const destination = await window.showSaveDialog({ defaultUri: defaultRecordingUri(recording, documentUri), saveLabel: 'Save Recording' })
    if (!destination) return undefined

    const recordingDirectory = destination.path.endsWith('.recording') ? destination : destination.with({ path: `${destination.path}.recording` })
    return await tryTo(
      async () => {
        const savedDocumentUri = await args.drafts.commit(documentUri, recordingDirectory)
        await window.showInformationMessage(`Saved recording to ${recordingDirectory.fsPath}.`)
        return savedDocumentUri
      },
      async error => ((await window.showErrorMessage(`Could not save recording: ${getErrorMessage(error)}`, 'Choose Another Location', 'Cancel')) === 'Choose Another Location' ? saveDraft(documentUri) : undefined),
    )
  }

  function defaultRecordingUri(recording: Recording, documentUri: Uri): Uri | undefined {
    const workspaceFolder = workspace.getWorkspaceFolder(documentUri) ?? workspace.workspaceFolders?.[0]
    if (!workspaceFolder) return undefined

    const name = recording.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    return Uri.joinPath(workspaceFolder.uri, `${name || 'recording'}.recording`)
  }

  async function withErrorMessage(operation: () => Promise<void>): Promise<void> {
    await tryTo(operation, error => window.showErrorMessage(getErrorMessage(error)))
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
  drafts: RecordingDraftStore
  onPlay: (recording?: Recording) => Promise<void>
}

interface ResolveRecordingEditorArgs extends CreateRecordingEditorProviderArgs {
  document: TextDocument
  panel: WebviewPanel
}
