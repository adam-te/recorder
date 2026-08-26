import { generateLocatorCandidates } from '#runtime/injected/locators/generateLocatorCandidates.ts'
import { generateSelectorCandidates } from '#runtime/injected/locators/generateSelectorCandidates.ts'
import { DISPOSE_OVERLAY_FUNCTION_NAME, OVERLAY_CONFIG_NAME, RECORDER_UI_ATTRIBUTE, STOP_BINDING_NAME } from '#runtime/injected/protocol.ts'
import * as ariaRuntime from '@te/aria/browser'

import { formatPlaywrightLocator } from '@te/recorder-core/playwright/locator'
import { createRecordingOverlay, type RecordingOverlay } from '@te/recorder-ui/recording-overlay'

const globalRecord = globalThis as unknown as Record<string, unknown>
const config = globalRecord[OVERLAY_CONFIG_NAME] as OverlayConfig | undefined

delete globalRecord[OVERLAY_CONFIG_NAME]
if (!document.querySelector(`[${RECORDER_UI_ATTRIBUTE}]`)) {
  let recordingOverlay: RecordingOverlay | undefined
  const showsControls = window === window.top && Boolean(config?.showsControls)

  if (document.documentElement) {
    showRecordingOverlay()
  } else {
    document.addEventListener('DOMContentLoaded', showRecordingOverlay, { once: true })
  }
  globalRecord[DISPOSE_OVERLAY_FUNCTION_NAME] = disposeRecordingOverlay

  function showRecordingOverlay(): void {
    recordingOverlay = createRecordingOverlay({
      describeElement,
      onStopRequested: showsControls ? () => (globalThis as unknown as Record<string, () => Promise<void>>)[STOP_BINDING_NAME]() : undefined,
      recorderUiAttribute: RECORDER_UI_ATTRIBUTE,
      showsControls,
    })
  }

  function describeElement(element: Element): string {
    const locator = generateLocatorCandidates(element, generateSelectorCandidates, ariaRuntime)[0] ?? { kind: 'css' as const, value: element.tagName.toLowerCase() }

    return formatPlaywrightLocator(locator, { includePage: false })
  }

  async function disposeRecordingOverlay(): Promise<void> {
    document.removeEventListener('DOMContentLoaded', showRecordingOverlay)
    await recordingOverlay?.dispose()
    delete globalRecord[DISPOSE_OVERLAY_FUNCTION_NAME]
  }
}

interface OverlayConfig {
  showsControls: boolean
}
