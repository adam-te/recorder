<script lang="ts">
  interface Props {
    onCopy: (text: string) => void
    onSave: (source: string, suggestedFileName: string) => void
    source: string
    suggestedFileName: string
  }

  let { onCopy, onSave, source, suggestedFileName }: Props = $props()
</script>

<section class="script-panel">
  <div class="script-toolbar">
    <div>
      <h2>ThousandEyes JavaScript</h2>
      <p>Generated from the current recording.</p>
    </div>
    <div class="script-actions">
      <button class="button" type="button" onclick={() => onCopy(source)}>Copy</button>
      <button class="button primary" type="button" onclick={() => onSave(source, suggestedFileName)}>Save .js</button>
    </div>
  </div>
  <pre class="script-source"><code>{source}</code></pre>
</section>
