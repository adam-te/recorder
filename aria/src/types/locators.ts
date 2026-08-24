export type { AriaLocatorCandidate, AriaLocatorStep }

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

type AriaLocatorStep = AriaLabelLocatorStep | AriaRoleLocatorStep
