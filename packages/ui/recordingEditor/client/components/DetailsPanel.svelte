<script lang="ts">

  import type { ActionStep } from '@te/recorder-recording'

  import { actionProperties, summarizeAction } from '#ui/recordingEditor/client/presentation.ts'
  import EmptyState from './EmptyState.svelte'
  import LocatorList from './LocatorList.svelte'
  import ScreenshotPanel from './ScreenshotPanel.svelte'
  import SnapshotPanel from './SnapshotPanel.svelte'

  import type { ScreenshotState, SnapshotState } from '#ui/recordingEditor/client/types.ts'

  interface Props {
    onCopy: (text: string) => void
    actions: ActionStep[]
    screenshotState: ScreenshotState
    selectedActionIndex: number
    snapshotState: SnapshotState
  }

  let { actions, onCopy, screenshotState, selectedActionIndex, snapshotState }: Props = $props()
  let action = $derived(actions[selectedActionIndex])
  let properties = $derived(action ? actionProperties(action) : [])
  let inspectorTab = $state<'accessibility' | 'locators'>('locators')
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

    <div class="step-workspace">
      {#key `${selectedActionIndex}:${screenshotState.loading ? 'loading' : (screenshotState.url ?? 'unavailable')}`}
        <ScreenshotPanel screenshot={screenshotState} />
      {/key}

      <div class="step-inspector">
        {#if properties.length > 0}
          <dl class="property-list">
            {#each properties as [label, value]}
              <dt>{label}</dt>
              <dd>{value}</dd>
            {/each}
          </dl>
        {/if}

        {#if 'locatorCandidates' in action}
          <div class="inspector-tabs" role="tablist" aria-label="Step details">
            <button class:active={inspectorTab === 'locators'} type="button" role="tab" aria-selected={inspectorTab === 'locators'} onclick={() => (inspectorTab = 'locators')}>Locators</button>
            <button class:active={inspectorTab === 'accessibility'} type="button" role="tab" aria-selected={inspectorTab === 'accessibility'} onclick={() => (inspectorTab = 'accessibility')}>Accessibility</button>
          </div>

          <div role="tabpanel">
            {#if inspectorTab === 'locators'}
              <LocatorList locators={action.locatorCandidates} {onCopy} />
            {:else}
              <SnapshotPanel state={snapshotState} />
            {/if}
          </div>
        {:else}
          <EmptyState title="No interaction details" detail="Screenshots and accessibility snapshots are captured for steps that interact with an element." />
        {/if}
      </div>
    </div>
  {:else}
    <EmptyState title="This recording has no actions." />
  {/if}
</section>
