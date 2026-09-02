<script lang="ts">
  import EmptyState from './EmptyState.svelte'

  import type { ScreenshotState } from '#ui/recordingEditor/client/types.ts'

  interface Props {
    screenshot: ScreenshotState
  }

  let { screenshot }: Props = $props()
  let actualSize = $state(false)
  let failed = $state(false)
  let loaded = $state(false)
</script>

<section class="screenshot-section">
  <div class="section-title-row">
    <h3>Screenshot</h3>

    {#if screenshot.url && !failed}
      <div class="screenshot-actions">
        <button class="button small" type="button" onclick={() => (actualSize = !actualSize)}>{actualSize ? 'Fit' : 'Actual size'}</button>
        <a class="button small" href={screenshot.url} target="_blank" rel="noreferrer">Open image</a>
      </div>
    {/if}
  </div>

  {#if screenshot.loading}
    <div class="screenshot-canvas"><EmptyState title="Loading screenshot…" /></div>
  {:else if !screenshot.url}
    <div class="screenshot-canvas"><EmptyState title="No screenshot captured" detail="Screenshots are captured for steps that interact with an element." /></div>
  {:else if failed}
    <div class="screenshot-canvas"><EmptyState title="Screenshot unavailable" detail="The captured image could not be loaded." /></div>
  {:else}
    <div class="screenshot-canvas" class:actual-size={actualSize}>
      <img class:loaded src={screenshot.url} alt="Page captured for the selected step" onload={() => (loaded = true)} onerror={() => (failed = true)} />
      {#if !loaded}<EmptyState title="Loading screenshot…" />{/if}
    </div>
  {/if}
</section>
