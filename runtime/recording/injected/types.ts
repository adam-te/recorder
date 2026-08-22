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

interface CapturedAriaLabelSelectorStep {
  exact?: boolean
  method: 'label'
  text: string
}

interface CapturedAriaRoleSelectorStep {
  exact?: boolean
  method: 'role'
  name?: string
  role: string
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
  ariaSnapshot: string
  event: CapturedInteractionEvent
  ref?: string
  selectors: CapturedSelector[]
}

type CapturedInteractionEvent = CapturedChangeEvent | CapturedClickEvent | CapturedInputEvent | CapturedKeydownEvent
type CapturedAriaSelectorStep = CapturedAriaLabelSelectorStep | CapturedAriaRoleSelectorStep
type CapturedSelector = CapturedAriaSelector | CapturedCssSelector
