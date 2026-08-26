<script lang="ts">
  import type { Recording } from '@te/recorder-core'

  import { actionProperties, summarizeAction } from '../presentation.ts'
  import EmptyState from './EmptyState.svelte'
  import LocatorList from './LocatorList.svelte'
  import SnapshotPanel from './SnapshotPanel.svelte'

  import type { SnapshotState } from '../types.ts'

  interface Props {
    onCopy: (text: string) => void
    recording: Recording
    selectedActionIndex: number
    snapshotState: SnapshotState
  }

  let { onCopy, recording, selectedActionIndex, snapshotState }: Props = $props()
  let action = $derived(recording.actions[selectedActionIndex])
  let properties = $derived(action ? actionProperties(action) : [])
</script>

<section class="detail-panel">
  {#if action}
    <div class="detail-title">
      <div class="eyebrow">Step {selectedActionIndex + 1}</div>
      <h2>{summarizeAction(action)}</h2>
    </div>

    <div class="page-url">
      <span class="field-label">Page</span>
      <span class="field-value">{action.pageUrl}</span>
    </div>

    {#if properties.length > 0}
      <dl class="property-list">
        {#each properties as [label, value]}
          <dt>{label}</dt>
          <dd>{value}</dd>
        {/each}
      </dl>
    {/if}

    {#if 'locatorCandidates' in action}
      <LocatorList locators={action.locatorCandidates} {onCopy} />
      <SnapshotPanel state={snapshotState} />
    {:else}
      <EmptyState title="No accessibility snapshot for navigation actions." detail="Snapshots are captured for actions that interact with an element." />
    {/if}
  {:else}
    <EmptyState title="This recording has no actions." />
  {/if}
</section>
