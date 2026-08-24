import { mount, type Component } from 'svelte'

import RecordingEditorComponent from './RecordingEditor.svelte'
import './recordingEditor.css'
import type { CreateRecordingEditorArgs, RecordingEditor } from './types.ts'

export { createRecordingEditor }
export type { RecordingEditor, RecordingEditorHostMessage, RecordingEditorUiMessage } from './types.ts'

function createRecordingEditor({ root, sendMessage }: CreateRecordingEditorArgs): RecordingEditor {
  const component = mount(RecordingEditorComponent as unknown as Component<{ sendMessage: CreateRecordingEditorArgs['sendMessage'] }, RecordingEditor>, {
    props: { sendMessage },
    target: root,
  })

  return { ready: component.ready, receive: component.receive }
}
