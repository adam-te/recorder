import { createRecordingEditor, type RecordingEditorHostMessage, type RecordingEditorUiMessage } from '@te/recorder-ui/recording-editor'

import './vscodeRecordingEditor.css'

declare function acquireVsCodeApi(): { postMessage: (message: RecordingEditorUiMessage) => void }

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Recording editor root was not found.')

const vscode = acquireVsCodeApi()
const editor = createRecordingEditor({
  root,
  send: vscode.postMessage,
})

window.addEventListener('message', (event: MessageEvent<RecordingEditorHostMessage>) => editor.receive(event.data))
editor.ready()
