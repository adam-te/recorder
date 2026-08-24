<script lang="ts">
  import EmptyState from './EmptyState.svelte'

  import type { SnapshotState } from '../types.ts'

  interface Props {
    state: SnapshotState
  }

  let { state }: Props = $props()
</script>

<section class="detail-section snapshot-section">
  <h3>Accessibility snapshot</h3>

  {#if state.loading}
    <EmptyState title="Loading snapshot…" />
  {:else if state.error}
    <EmptyState title="Snapshot unavailable" detail={state.error} />
  {:else if state.yaml === undefined}
    <EmptyState title="No snapshot recorded for this action." />
  {:else}
    <pre class="snapshot-yaml"><code>{#each state.yaml.split('\n') as line, lineIndex}<span class="yaml-line" class:target-line={lineIndex === state.targetLine}>{line}</span>{/each}</code></pre>
  {/if}
</section>
