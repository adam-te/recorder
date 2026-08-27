import { RECORDING_DOCUMENT_PATH } from '@te/recorder-core'
import { createRecordingEditor, type RecordingEditorHostMessage, type RecordingEditorUiMessage } from '@te/recorder-ui/recording-editor'
import { tryTo } from '@te/recorder-utils'

import './recordingEditorTheme.css'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Recording editor root was not found.')

const editor = createRecordingEditor({ root, sendMessage: message => void sendMessage(message) })

async function sendMessage(message: RecordingEditorUiMessage): Promise<void> {
  await tryTo(
    async () => {
      if (message.type === 'copy') {
        await navigator.clipboard.writeText(message.text)
        return
      }

      if (message.type === 'openJson') {
        window.open(`./${RECORDING_DOCUMENT_PATH}`, '_blank', 'noopener')
        return
      }

      const response = await fetch('./api/messages', {
        body: JSON.stringify(message),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
      const result = (await response.json()) as MessageResponse
      if (!response.ok) throw new Error(result.error ?? `The recording editor request failed (${response.status}).`)
      result.messages?.forEach(hostMessage => editor.receive(hostMessage))
      if (result.error) window.alert(result.error)
    },
    error => window.alert(error.message),
  )
}

editor.ready()

interface MessageResponse {
  error?: string
  messages?: RecordingEditorHostMessage[]
}
