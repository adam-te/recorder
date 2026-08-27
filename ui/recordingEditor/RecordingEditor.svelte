<script lang="ts">
  import type { Recording } from '@te/recorder-core'

  import ActionList from './components/ActionList.svelte'
  import DetailsPanel from './components/DetailsPanel.svelte'
  import EmptyState from './components/EmptyState.svelte'
  import { formatDate } from './presentation.ts'

  import type { RecordingEditorCallbacks, RecordingEditorHostMessage, SnapshotState } from './types.ts'

  let { onCopy, onDiscard, onOpenJson, onPlay, onReady, onSave, onSelectAction }: RecordingEditorCallbacks = $props()
  let recording = $state<Recording>()
  let pending = $state(false)
  let selectedActionIndex = $state(0)
  let snapshotState = $state<SnapshotState>({ loading: true })
  let decisionBusy = $state(false)
  let fatalError = $state<string>()

  export function ready(): void {
    onReady()
  }

  export function receive(message: RecordingEditorHostMessage): void {
    if (message.type === 'recording') {
      fatalError = undefined
      recording = message.recording
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
    onSelectAction(actionIndex)
  }

  function decidePreview(decide: () => void): void {
    decisionBusy = true
    decide()
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
        <button class="button" type="button" disabled={decisionBusy} onclick={() => decidePreview(onDiscard)}>Discard</button>
        <button class="button primary" type="button" disabled={decisionBusy} onclick={() => decidePreview(onSave)}>
          {decisionBusy ? 'Working…' : 'Save Recording'}
        </button>
      {/if}
      <button class:primary={!pending} class="button" type="button" onclick={onPlay}>Play</button>
      <button class="button" type="button" onclick={onOpenJson}>Open JSON</button>
    </div>
  </header>

  <div class="editor-body">
    <ActionList {recording} {selectedActionIndex} onSelect={selectAction} />
    <DetailsPanel {recording} {selectedActionIndex} {snapshotState} {onCopy} />
  </div>
{/if}
