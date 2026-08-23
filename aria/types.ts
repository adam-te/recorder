export type { AriaLocatorCandidate, AriaLocatorOptions, AriaLocatorStep, AriaRuntime, AriaSnapshot, AriaSnapshotOptions }

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
  generateAriaLocatorCandidates: (options: AriaLocatorOptions) => AriaLocatorCandidate[]
  generateAriaSnapshot: (options: AriaSnapshotOptions) => AriaSnapshot
}

interface AriaSnapshot {
  snapshot: string
  targetRef?: string
}

interface AriaSnapshotOptions {
  target: Element
}

interface AriaLocatorOptions extends AriaSnapshotOptions {
  excludeElement?: (element: Element) => boolean
  getShadowRoot?: (element: Element) => ShadowRoot | null
}

type AriaLocatorStep = AriaLabelLocatorStep | AriaRoleLocatorStep
