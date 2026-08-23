export type { AriaLocatorCandidate, AriaLocatorStep, AriaRuntime, AriaSnapshot, AriaTraversalOptions }

interface AriaLabelLocatorStep {
  exact?: boolean
  method: 'label'
  text: string
}

interface AriaRoleLocatorStep {
  exact?: boolean
  method: 'role'
  name?: string
  role: string
}

interface AriaLocatorCandidate {
  steps: AriaLocatorStep[]
}

interface AriaRuntime {
  generateAriaLocatorCandidates: (options: AriaTraversalOptions) => AriaLocatorCandidate[]
  generateAriaSnapshot: (options: AriaTraversalOptions) => AriaSnapshot
}

interface AriaSnapshot {
  snapshot: string
  targetRef?: string
}

interface AriaTraversalOptions {
  excludeElement?: (element: Element) => boolean
  getShadowRoot?: (element: Element) => ShadowRoot | null
  target: Element
}

type AriaLocatorStep = AriaLabelLocatorStep | AriaRoleLocatorStep
