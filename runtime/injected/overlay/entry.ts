import { showRecordingOverlay } from '#recorder-runtime/injected/overlay/showRecordingOverlay.ts'
import { DISPOSE_OVERLAY_FUNCTION_NAME, OVERLAY_CONFIG_NAME, RECORDER_UI_ATTRIBUTE, STOP_BINDING_NAME } from '#recorder-runtime/injected/protocol.ts'
import type { AriaRuntime } from '@te/aria/browser'

declare const ariaRuntime: AriaRuntime

const globalRecord = globalThis as unknown as Record<string, OverlayConfig | undefined>
const config = globalRecord[OVERLAY_CONFIG_NAME]

delete globalRecord[OVERLAY_CONFIG_NAME]
showRecordingOverlay(
  {
    disposeFunctionName: DISPOSE_OVERLAY_FUNCTION_NAME,
    recorderUiAttribute: RECORDER_UI_ATTRIBUTE,
    stopBindingName: config?.showsControls ? STOP_BINDING_NAME : undefined,
  },
  ariaRuntime,
)

interface OverlayConfig {
  showsControls: boolean
}
