import { mount, type Component } from 'svelte'

import RecordingEditorComponent from './RecordingEditor.svelte'
import './recordingEditor.css'
import type { CreateRecordingEditorArgs, RecordingEditor, RecordingEditorCallbacks } from './types.ts'

export { createRecordingEditor }

function createRecordingEditor({ root, send }: CreateRecordingEditorArgs): RecordingEditor {
  const component = mount(RecordingEditorComponent as unknown as Component<RecordingEditorCallbacks, RecordingEditor>, {
    props: {
      onCopy: text => send({ type: 'copy', text }),
      onDiscard: () => send({ type: 'discard' }),
      onOpenJson: () => send({ type: 'openJson' }),
      onPlay: () => send({ type: 'play' }),
      onReady: () => send({ type: 'ready' }),
      onSave: () => send({ type: 'save' }),
      onSelectAction: actionIndex => send({ type: 'selectAction', actionIndex }),
    },
    target: root,
  })

  return { ready: component.ready, receive: component.receive }
}
