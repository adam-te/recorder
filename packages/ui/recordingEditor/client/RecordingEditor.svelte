<script lang="ts">
  import { generateThousandEyesScript, type Recording } from '@te/recorder-recording'
  import { tryTo } from '@te/recorder-utils'

  import ActionList from './components/ActionList.svelte'
  import DetailsPanel from './components/DetailsPanel.svelte'
  import EmptyState from './components/EmptyState.svelte'
  import ThousandEyesPanel from './components/ThousandEyesPanel.svelte'
  import { formatDate } from './presentation.ts'

  import type { RecordingEditorHostMessage } from '#ui/recordingEditor/protocol.ts'
  import type { RecordingEditorCallbacks, ScreenshotState, SnapshotState } from './types.ts'

  let { onCopy, onDiscard, onOpenJson, onPlay, onReady, onSave, onSaveThousandEyes, onSelectAction, onUpdateThousandEyes }: RecordingEditorCallbacks = $props()
  let recording = $state<Recording>()
  let pending = $state(false)
  let selectedActionIndex = $state(0)
  let screenshotState = $state<ScreenshotState>({ loading: true })
  let snapshotState = $state<SnapshotState>({ loading: true })
  let decisionBusy = $state(false)
  let fatalError = $state<string>()
  let view = $state<'steps' | 'thousandeyes'>('steps')
  let thousandEyesScript = $derived.by(() => {
    if (!recording) return undefined

    return generateScript(recording)
  })

  export function ready(): void {
    onReady()
  }

  export function receive(message: RecordingEditorHostMessage): void {
    if (message.type === 'recording') {
      fatalError = undefined
      recording = message.recording
      pending = message.pending
      selectedActionIndex = message.selectedActionIndex
      screenshotState = { loading: true }
      snapshotState = { loading: true }
    } else if (message.type === 'preview' && message.actionIndex === selectedActionIndex) {
      screenshotState = { url: message.screenshotUrl }
      snapshotState = { error: message.snapshotError, targetLine: message.targetLine, yaml: message.yaml }
    } else if (message.type === 'error') {
      fatalError = message.message
    } else if (message.type === 'decisionCancelled') {
      decisionBusy = false
    }
  }

  function selectAction(actionIndex: number): void {
    selectedActionIndex = actionIndex
    screenshotState = { loading: true }
    snapshotState = { loading: true }
    onSelectAction(actionIndex)
  }

  function decidePreview(decide: () => void): void {
    decisionBusy = true
    decide()
  }

  function updateThousandEyes(thousandEyes: Recording['thousandEyes']): void {
    if (!recording) return

    recording = { ...recording, thousandEyes }
    onUpdateThousandEyes(thousandEyes)
  }

  function generateScript(currentRecording: Recording): { error: string } | { source: string } {
    return tryTo(
      () => ({ source: generateThousandEyesScript(currentRecording).source }),
      error => ({ error: error instanceof Error ? error.message : String(error) }),
    )
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

  <div class="view-tabs" role="tablist" aria-label="Recording view">
    <button class:active={view === 'steps'} type="button" role="tab" aria-selected={view === 'steps'} onclick={() => (view = 'steps')}>Steps</button>
    <button class:active={view === 'thousandeyes'} type="button" role="tab" aria-selected={view === 'thousandeyes'} onclick={() => (view = 'thousandeyes')}>ThousandEyes JS</button>
  </div>

  <div role="tabpanel">
    {#if view === 'steps'}
      <div class="editor-body">
        <ActionList {recording} {selectedActionIndex} onSelect={selectAction} onUpdateThousandEyes={updateThousandEyes} />
        <DetailsPanel {recording} {screenshotState} {selectedActionIndex} {snapshotState} {onCopy} />
      </div>
    {:else if thousandEyesScript && 'source' in thousandEyesScript}
      <ThousandEyesPanel source={thousandEyesScript.source} suggestedFileName={scriptFileName(recording.title)} {onCopy} onSave={onSaveThousandEyes} />
    {:else}
      <EmptyState title="Could not generate ThousandEyes JS" detail={thousandEyesScript?.error} />
    {/if}
  </div>
{/if}

<script module lang="ts">
  function scriptFileName(title: string): string {
    return `${
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'recording'
    }.js`
  }
</script>
