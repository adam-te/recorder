import type { AriaLocatorStep, AriaSnapshot } from '@te/aria'

// This is the only source contract shared by the Playwright host and injected runtime.
export { DISPOSE_OVERLAY_FUNCTION_NAME, INTERACTION_BINDING_NAME, OVERLAY_CONFIG_NAME, RECORDER_UI_ATTRIBUTE, SELECTOR_GENERATOR_NAME, STOP_BINDING_NAME }
export type { CapturedAriaSelector, CapturedAriaSelectorStep, CapturedCssSelector, CapturedInteractionEvent, CapturedSelector, CapturedTestIdSelector, SerializedInteraction }

const DISPOSE_OVERLAY_FUNCTION_NAME = '__thousandEyesRecorderDisposeOverlay'
const INTERACTION_BINDING_NAME = '__thousandEyesRecorderCaptureInteraction'
const OVERLAY_CONFIG_NAME = '__thousandEyesRecorderOverlayConfig'
const RECORDER_UI_ATTRIBUTE = 'data-thousandeyes-recorder-ui'
const SELECTOR_GENERATOR_NAME = '__thousandEyesRecorderGenerateSelector'
const STOP_BINDING_NAME = '__thousandEyesRecorderStop'

interface CapturedChangeEvent {
  kind: 'change'
}

interface CapturedClickEvent {
  kind: 'click'
}

interface CapturedInputEvent {
  inputType: string
  kind: 'input'
}

interface CapturedKeydownEvent {
  code: string
  key: string
  kind: 'keydown'
  repeat: boolean
}

interface CapturedAriaSelector {
  kind: 'aria'
  steps: CapturedAriaSelectorStep[]
}

interface CapturedCssSelector {
  kind: 'css'
  value: string
}

interface CapturedTestIdSelector {
  kind: 'test-id'
  value: string
}

interface SerializedInteraction {
  ariaSnapshot: AriaSnapshot
  event: CapturedInteractionEvent
  selectors: CapturedSelector[]
  targetRef?: string
}

type CapturedInteractionEvent = CapturedChangeEvent | CapturedClickEvent | CapturedInputEvent | CapturedKeydownEvent
type CapturedAriaSelectorStep = AriaLocatorStep
type CapturedSelector = CapturedAriaSelector | CapturedCssSelector | CapturedTestIdSelector
