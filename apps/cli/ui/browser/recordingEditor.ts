import { RECORDING_DOCUMENT_PATH } from '@te/recorder-recording'
import { createRecordingEditor, type RecordingEditorHostMessage, type RecordingEditorUiMessage } from '@te/recorder-ui/recording-editor'
import { tryTo } from '@te/recorder-utils'

import './recordingEditorTheme.css'

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('Recording editor root was not found.')

const editor = createRecordingEditor({
  root,
  send: message => void sendMessage(message),
})

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

      if (message.type === 'saveThousandEyes') {
        download(message.source, message.suggestedFileName)
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

function download(source: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
  const link = document.createElement('a')

  link.download = fileName
  link.href = url
  link.click()
  setTimeout(() => URL.revokeObjectURL(url))
}

interface MessageResponse {
  error?: string
  messages?: RecordingEditorHostMessage[]
}
