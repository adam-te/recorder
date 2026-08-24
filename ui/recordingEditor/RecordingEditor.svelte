<script lang="ts">
  import type { RecordingDocument } from '@te/recorder-core'

  import ActionList from './components/ActionList.svelte'
  import DetailsPanel from './components/DetailsPanel.svelte'
  import EmptyState from './components/EmptyState.svelte'
  import { formatDate } from './presentation.ts'

  import type { RecordingEditorHostMessage, RecordingEditorUiMessage, SnapshotState } from './types.ts'

  interface Props {
    sendMessage: (message: RecordingEditorUiMessage) => void
  }

  let { sendMessage }: Props = $props()
  let recording = $state<RecordingDocument>()
  let pending = $state(false)
  let selectedActionIndex = $state(0)
  let snapshotState = $state<SnapshotState>({ loading: true })
  let decisionBusy = $state(false)
  let fatalError = $state<string>()

  export function ready(): void {
    sendMessage({ type: 'ready' })
  }

  export function receive(message: RecordingEditorHostMessage): void {
    if (message.type === 'document') {
      fatalError = undefined
      recording = message.document
      pending = message.pending
      selectedActionIndex = message.selectedActionIndex
      snapshotState = { loading: true }
    } else if (message.type === 'snapshot' && message.actionIndex === selectedActionIndex) {
      snapshotState = { error: message.error, targetLine: message.targetLine, yaml: message.yaml }
    } else if (message.type === 'error') {
      fatalError = message.message
    } else if (message.type === 'decisionCancelled') {
      decisionBusy = false
    }
  }

  function selectAction(actionIndex: number): void {
    selectedActionIndex = actionIndex
    snapshotState = { loading: true }
    sendMessage({ type: 'selectAction', actionIndex })
  }

  function decidePreview(type: 'discard' | 'save'): void {
    decisionBusy = true
    sendMessage({ type })
  }
</script>

{#if fatalError}
  <EmptyState title="Could not open recording" detail={fatalError} />
{:else if !recording}
  <EmptyState title="Opening recording…" />
{:else}
  <header class="recording-header">
    <div class="recording-heading">
      <h1>{recording.title}</h1>
      <div class="start-url" title={recording.startUrl}>{recording.startUrl}</div>
    </div>

    <div class="metadata">{recording.actions.length} steps · {formatDate(recording.createdAt)}</div>

    <div class="header-actions">
      {#if pending}
        <button class="button" type="button" disabled={decisionBusy} onclick={() => decidePreview('discard')}>Discard</button>
        <button class="button primary" type="button" disabled={decisionBusy} onclick={() => decidePreview('save')}>
          {decisionBusy ? 'Working…' : 'Save Recording'}
        </button>
      {/if}
      <button class:primary={!pending} class="button" type="button" onclick={() => sendMessage({ type: 'play' })}>Play</button>
      <button class="button" type="button" onclick={() => sendMessage({ type: 'openJson' })}>Open JSON</button>
    </div>
  </header>

  <div class="editor-body">
    <ActionList {recording} {selectedActionIndex} onSelect={selectAction} />
    <DetailsPanel {recording} {selectedActionIndex} {snapshotState} onCopy={text => sendMessage({ type: 'copy', text })} />
  </div>
{/if}
