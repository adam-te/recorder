import { createRecordingEditor, type RecordingEditorHostMessage, type RecordingEditorUiMessage } from '@te/recorder-ui/recording-editor'

import './vscodeRecordingEditor.css'

declare function acquireVsCodeApi(): { postMessage: (message: RecordingEditorUiMessage) => void }

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Recording editor root was not found.')

const vscode = acquireVsCodeApi()
const editor = createRecordingEditor({
  callbacks: {
    onCopy: text => vscode.postMessage({ type: 'copy', text }),
    onDiscard: () => vscode.postMessage({ type: 'discard' }),
    onOpenJson: () => vscode.postMessage({ type: 'openJson' }),
    onPlay: () => vscode.postMessage({ type: 'play' }),
    onReady: () => vscode.postMessage({ type: 'ready' }),
    onSave: () => vscode.postMessage({ type: 'save' }),
    onSelectAction: actionIndex => vscode.postMessage({ type: 'selectAction', actionIndex }),
  },
  root,
})

window.addEventListener('message', (event: MessageEvent<RecordingEditorHostMessage>) => editor.receive(event.data))
editor.ready()
