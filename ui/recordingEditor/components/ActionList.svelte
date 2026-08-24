<script lang="ts">
  import type { RecordingDocument } from '@te/recorder-core'

  import { actionKindLabel, summarizeAction } from '../presentation.ts'

  interface Props {
    onSelect: (actionIndex: number) => void
    recording: RecordingDocument
    selectedActionIndex: number
  }

  let { onSelect, recording, selectedActionIndex }: Props = $props()
</script>

<nav class="action-sidebar" aria-label="Recording steps">
  <h2 class="section-heading">Steps</h2>
  <ol class="action-list">
    {#each recording.actions as action, actionIndex}
      <li>
        <button class="action-row" class:selected={actionIndex === selectedActionIndex} type="button" onclick={() => onSelect(actionIndex)}>
          <span class="action-number">{actionIndex + 1}</span>
          <span class="action-kind kind-{action.kind}">{actionKindLabel(action.kind)}</span>
          <span class="action-summary">{summarizeAction(action)}</span>
        </button>
      </li>
    {/each}
  </ol>
</nav>
