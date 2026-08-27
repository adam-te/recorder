import { mount, type Component } from 'svelte'

import RecordingEditorComponent from './RecordingEditor.svelte'
import './recordingEditor.css'
import type { CreateRecordingEditorArgs, RecordingEditor, RecordingEditorCallbacks } from './types.ts'

export { createRecordingEditor }

function createRecordingEditor({ callbacks, root }: CreateRecordingEditorArgs): RecordingEditor {
  const component = mount(RecordingEditorComponent as unknown as Component<RecordingEditorCallbacks, RecordingEditor>, {
    props: callbacks,
    target: root,
  })

  return { ready: component.ready, receive: component.receive }
}
