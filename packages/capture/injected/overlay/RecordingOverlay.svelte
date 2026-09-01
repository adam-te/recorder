<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    describeElement: (element: Element) => string
    onStopRequested?: () => Promise<void> | void
    recorderUiAttribute: string
    showsControls: boolean
  }

  let { describeElement, onStopRequested, recorderUiAttribute, showsControls }: Props = $props()
  let highlight: HTMLDivElement | undefined = undefined
  let tooltip: HTMLDivElement | undefined = undefined
  let stopping = $state(false)

  onMount(() => {
    const resizeObserver = new ResizeObserver(queueRender)
    let hoveredElement: Element | undefined
    let locatorElement: Element | undefined
    let locatorText = ''
    let animationFrame: number | undefined

    window.addEventListener('mousemove', updateHoveredElement, { capture: true, passive: true })
    window.addEventListener('resize', queueRender, { passive: true })
    window.addEventListener('scroll', queueRender, { capture: true, passive: true })

    return () => {
      window.removeEventListener('mousemove', updateHoveredElement, { capture: true })
      window.removeEventListener('resize', queueRender)
      window.removeEventListener('scroll', queueRender, { capture: true })
      resizeObserver.disconnect()
      if (animationFrame !== undefined) {
        cancelAnimationFrame(animationFrame)
      }
    }

    function updateHoveredElement(event: MouseEvent): void {
      const path = event.composedPath()
      const target = path.find(candidate => candidate instanceof Element)
      const isRecorderUiEvent = path.some(candidate => candidate instanceof Element && candidate.hasAttribute(recorderUiAttribute))
      const nextElement = isRecorderUiEvent ? undefined : target

      if (nextElement === hoveredElement) return

      resizeObserver.disconnect()
      hoveredElement = nextElement
      if (hoveredElement) {
        resizeObserver.observe(hoveredElement)
      }
      queueRender()
    }

    function queueRender(): void {
      animationFrame ??= requestAnimationFrame(render)
    }

    function render(): void {
      animationFrame = undefined
      if (!highlight || !tooltip) {
        return
      }
      if (!hoveredElement?.isConnected) {
        highlight.style.display = 'none'
        tooltip.style.display = 'none'
        return
      }

      const rect = hoveredElement.getBoundingClientRect()
      if (locatorElement !== hoveredElement) {
        locatorElement = hoveredElement
        locatorText = describeElement(hoveredElement)
      }

      Object.assign(highlight.style, { display: 'block', height: `${rect.height}px`, left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px` })
      tooltip.textContent = locatorText
      tooltip.style.display = 'block'
      tooltip.style.visibility = 'hidden'

      const tooltipRect = tooltip.getBoundingClientRect()
      const left = Math.min(Math.max(rect.left, 4), Math.max(4, window.innerWidth - tooltipRect.width - 4))
      const belowTop = rect.bottom + 6
      const top = belowTop + tooltipRect.height <= window.innerHeight - 4 ? belowTop : Math.max(4, rect.top - tooltipRect.height - 6)

      Object.assign(tooltip.style, { left: `${left}px`, top: `${top}px`, visibility: 'visible' })
    }
  })

  function stop(event: MouseEvent): void {
    event.preventDefault()
    event.stopImmediatePropagation()
    stopping = true
    void onStopRequested?.()
  }
</script>

<div bind:this={highlight} class="highlight"></div>
<div bind:this={tooltip} class="tooltip"></div>
{#if showsControls}
  <div class="panel" aria-label="Recording controls" role="status">
    <span class="status"><span class="indicator"></span>Recording</span>
    <button type="button" disabled={stopping} onclick={stop}>Stop recording</button>
  </div>
{/if}
