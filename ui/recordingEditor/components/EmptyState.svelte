<script lang="ts">
  interface Props {
    detail?: string
    title: string
  }

  let { detail, title }: Props = $props()
</script>

<div class="empty-state">
  <div class="empty-title">{title}</div>
  {#if detail}<div class="empty-detail">{detail}</div>{/if}
</div>
