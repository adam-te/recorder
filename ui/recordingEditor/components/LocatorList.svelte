<script lang="ts">
  import type { RecordedLocator } from '@te/recorder-core'
  import { formatPlaywrightLocator } from '@te/recorder-core/playwright/locator'

  interface Props {
    locators: RecordedLocator[]
    onCopy: (text: string) => void
  }

  let { locators, onCopy }: Props = $props()
  let copiedIndex = $state<number>()

  function copy(index: number, text: string): void {
    onCopy(text)
    copiedIndex = index
    window.setTimeout(() => {
      if (copiedIndex === index) copiedIndex = undefined
    }, 1200)
  }
</script>

<section class="detail-section">
  <h3>Locator candidates</h3>
  <ol class="locator-list">
    {#each locators as locator, index}
      {@const value = formatPlaywrightLocator(locator)}
      <li class="locator-row">
        <div class="locator-main">
          <span class="locator-rank">{index === 0 ? 'Preferred' : `Alternative ${index}`}</span>
          <code>{value}</code>
        </div>
        <button class="button small" type="button" onclick={() => copy(index, value)}>{copiedIndex === index ? 'Copied' : 'Copy'}</button>
      </li>
    {/each}
  </ol>
</section>
