import { mount, unmount } from 'svelte'

import RecordingOverlayComponent from './RecordingOverlay.svelte'
import { RECORDING_OVERLAY_STYLES } from './styles.ts'

export { createRecordingOverlay }
export type { CreateRecordingOverlayArgs, RecordingOverlay }

// This DOM adapter is bundled for execution inside recorded pages.

function createRecordingOverlay(args: CreateRecordingOverlayArgs): RecordingOverlay {
  const host = document.createElement('div')
  const shadowRoot = host.attachShadow({ mode: 'closed' })
  const styleSheet = new CSSStyleSheet()

  host.setAttribute(args.recorderUiAttribute, '')
  Object.entries({ all: 'initial', display: 'block', 'pointer-events': 'none', position: 'fixed', right: '16px', top: '16px', 'z-index': '2147483647' }).forEach(([property, value]) => host.style.setProperty(property, value, 'important'))
  if (!args.showsControls) {
    host.setAttribute('aria-hidden', 'true')
    host.inert = true
  }
  styleSheet.replaceSync(RECORDING_OVERLAY_STYLES)
  shadowRoot.adoptedStyleSheets = [styleSheet]
  document.documentElement.append(host)

  const component = mount(RecordingOverlayComponent, {
    props: args,
    target: shadowRoot,
  })

  return { dispose }

  async function dispose(): Promise<void> {
    await unmount(component)
    host.remove()
  }
}

interface CreateRecordingOverlayArgs {
  describeElement: (element: Element) => string
  onStopRequested?: () => Promise<void> | void
  recorderUiAttribute: string
  showsControls: boolean
}

interface RecordingOverlay {
  dispose: () => Promise<void>
}
