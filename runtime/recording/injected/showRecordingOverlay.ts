import type { CapturedCssSelector } from './types.ts'

export { RECORDING_OVERLAY_STYLES, showRecordingOverlay }

function showRecordingOverlay(args: ShowRecordingOverlayArgs, generateSelectorCandidates: (element: Element, maxCandidates?: number) => CapturedCssSelector[], overlayStyles: string): void {
  if (document.querySelector(`[${args.recorderUiAttribute}]`)) {
    return
  }
  if (!document.documentElement) {
    document.addEventListener('DOMContentLoaded', () => showRecordingOverlay(args, generateSelectorCandidates, overlayStyles), { once: true })
    return
  }

  const showsControls = window === window.top && Boolean(args.stopBindingName)
  const host = document.createElement('div')
  const shadowRoot = host.attachShadow({ mode: 'closed' })
  const styleSheet = new CSSStyleSheet()
  const highlight = document.createElement('div')
  const tooltip = document.createElement('div')
  const panel = showsControls ? document.createElement('div') : undefined
  const status = showsControls ? document.createElement('span') : undefined
  const indicator = showsControls ? document.createElement('span') : undefined
  const button = showsControls ? document.createElement('button') : undefined
  const resizeObserver = new ResizeObserver(queueRender)
  let hoveredElement: Element | undefined
  let animationFrame: number | undefined

  host.setAttribute(args.recorderUiAttribute, '')
  Object.entries({ all: 'initial', display: 'block', 'pointer-events': 'none', position: 'fixed', right: '16px', top: '16px', 'z-index': '2147483647' }).forEach(([property, value]) => host.style.setProperty(property, value, 'important'))
  if (!showsControls) {
    host.setAttribute('aria-hidden', 'true')
    host.inert = true
  }
  styleSheet.replaceSync(overlayStyles)
  shadowRoot.adoptedStyleSheets = [styleSheet]
  highlight.className = 'highlight'
  tooltip.className = 'tooltip'
  shadowRoot.append(highlight, tooltip)
  if (panel && status && indicator && button) {
    panel.className = 'panel'
    panel.setAttribute('aria-label', 'Recording controls')
    panel.setAttribute('role', 'status')
    status.className = 'status'
    status.append(indicator, 'Recording')
    indicator.className = 'indicator'
    button.type = 'button'
    button.textContent = 'Stop recording'
    panel.append(status, button)
    shadowRoot.append(panel)
  }

  button?.addEventListener('click', event => {
    event.preventDefault()
    event.stopImmediatePropagation()
    button.disabled = true
    void (globalThis as unknown as Record<string, () => Promise<void>>)[args.stopBindingName!]()
  })
  document.documentElement.append(host)
  window.addEventListener('mousemove', updateHoveredElement, { capture: true, passive: true })
  window.addEventListener('resize', queueRender, { passive: true })
  window.addEventListener('scroll', queueRender, { capture: true, passive: true })
  ;(globalThis as unknown as Record<string, () => void>)[args.disposeFunctionName] = dispose

  function updateHoveredElement(event: MouseEvent): void {
    const path = event.composedPath()
    const target = path.find(candidate => candidate instanceof Element)
    const isRecorderUiEvent = path.some(candidate => candidate instanceof Element && candidate.hasAttribute(args.recorderUiAttribute))
    const nextElement = isRecorderUiEvent ? undefined : target

    if (nextElement !== hoveredElement) {
      resizeObserver.disconnect()
      hoveredElement = nextElement
      if (hoveredElement) {
        resizeObserver.observe(hoveredElement)
      }
      queueRender()
    }
  }

  function queueRender(): void {
    animationFrame ??= requestAnimationFrame(render)
  }

  function render(): void {
    animationFrame = undefined
    if (!hoveredElement?.isConnected) {
      highlight.style.display = 'none'
      tooltip.style.display = 'none'
      return
    }

    const rect = hoveredElement.getBoundingClientRect()
    const selector = generateSelectorCandidates(hoveredElement, 1)[0]?.value ?? hoveredElement.tagName.toLowerCase()

    Object.assign(highlight.style, { display: 'block', height: `${rect.height}px`, left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px` })
    tooltip.textContent = selector
    tooltip.style.display = 'block'
    tooltip.style.visibility = 'hidden'

    const tooltipRect = tooltip.getBoundingClientRect()
    const left = Math.min(Math.max(rect.left, 4), Math.max(4, window.innerWidth - tooltipRect.width - 4))
    const belowTop = rect.bottom + 6
    const top = belowTop + tooltipRect.height <= window.innerHeight - 4 ? belowTop : Math.max(4, rect.top - tooltipRect.height - 6)

    Object.assign(tooltip.style, { left: `${left}px`, top: `${top}px`, visibility: 'visible' })
  }

  function dispose(): void {
    window.removeEventListener('mousemove', updateHoveredElement, { capture: true })
    window.removeEventListener('resize', queueRender)
    window.removeEventListener('scroll', queueRender, { capture: true })
    resizeObserver.disconnect()
    if (animationFrame !== undefined) {
      cancelAnimationFrame(animationFrame)
    }
    host.remove()
    delete (globalThis as unknown as Record<string, unknown>)[args.disposeFunctionName]
  }
}

const RECORDING_OVERLAY_STYLES = `
  .highlight {
    background: rgb(79 155 229 / 18%);
    border: 2px solid rgb(79 155 229 / 90%);
    box-sizing: border-box;
    display: none;
    pointer-events: none;
    position: fixed;
  }

  .tooltip {
    background: #202124;
    border: 1px solid #3c4043;
    border-radius: 5px;
    box-shadow: 0 2px 8px rgb(0 0 0 / 28%);
    box-sizing: border-box;
    color: #f1f3f4;
    display: none;
    font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    max-width: min(520px, calc(100vw - 8px));
    overflow: hidden;
    padding: 5px 7px;
    pointer-events: none;
    position: fixed;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .panel {
    align-items: center;
    background: #202124;
    border: 1px solid #3c4043;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgb(0 0 0 / 28%);
    display: flex;
    font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    gap: 10px;
    padding: 8px;
    pointer-events: auto;
  }

  .status {
    align-items: center;
    color: #f1f3f4;
    display: flex;
    gap: 7px;
    padding-left: 4px;
    white-space: nowrap;
  }

  .indicator {
    background: #ea4335;
    border-radius: 50%;
    height: 8px;
    width: 8px;
  }

  button {
    all: initial;
    background: #f1f3f4;
    border-radius: 5px;
    color: #202124;
    cursor: pointer;
    font: 600 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    padding: 6px 10px;
    white-space: nowrap;
  }

  button:hover { background: #fff; }
  button:focus-visible { outline: 2px solid #8ab4f8; outline-offset: 2px; }
  button:disabled { cursor: default; opacity: 0.65; }
`

interface ShowRecordingOverlayArgs {
  disposeFunctionName: string
  recorderUiAttribute: string
  stopBindingName?: string
}
