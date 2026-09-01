export type { AriaLocatorCandidate, AriaLocatorStep }

interface AriaLabelLocatorStep {
  exact?: boolean
  method: 'label'
  text: string
}

type AriaTextLocatorMethod = 'alt' | 'placeholder' | 'text' | 'title'

type AriaTextLocatorStep = {
  [Method in AriaTextLocatorMethod]: {
    exact?: boolean
    method: Method
    text: string
  }
}[AriaTextLocatorMethod]

interface AriaRoleLocatorStep {
  exact?: boolean
  method: 'role'
  name?: string
  role: string
}

interface AriaLocatorCandidate {
  steps: AriaLocatorStep[]
}

type AriaLocatorStep = AriaLabelLocatorStep | AriaRoleLocatorStep | AriaTextLocatorStep
