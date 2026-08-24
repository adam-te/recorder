import type { AriaLocatorStep, AriaSnapshot } from '@te/aria'

export type { CapturedAriaSelector, CapturedAriaSelectorStep, CapturedCssSelector, CapturedInteractionEvent, CapturedSelector, SerializedInteraction }

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

interface SerializedInteraction {
  ariaSnapshot: AriaSnapshot
  event: CapturedInteractionEvent
  selectors: CapturedSelector[]
  targetRef?: string
}

type CapturedInteractionEvent = CapturedChangeEvent | CapturedClickEvent | CapturedInputEvent | CapturedKeydownEvent
type CapturedAriaSelectorStep = AriaLocatorStep
type CapturedSelector = CapturedAriaSelector | CapturedCssSelector
