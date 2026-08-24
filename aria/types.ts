import type { AriaNode as PlaywrightAriaNode } from './vendor/playwright/isomorphic/ariaSnapshot.ts'

export type { AriaLocatorCandidate, AriaLocatorOptions, AriaLocatorStep, AriaNode, AriaRuntime, AriaSnapshot, AriaSnapshotOptions }

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
  renderAriaSnapshot: (snapshot: AriaSnapshot) => string
}

interface AriaSnapshot {
  playwrightVersion: string
  root: AriaNode
  schemaVersion: 1
  targetRef?: string
}

interface AriaNode extends Omit<PlaywrightAriaNode, 'children'> {
  ariaVisible: boolean
  children: (AriaNode | string)[]
}

interface AriaSnapshotOptions {
  target: Element
  targetPath?: Element[]
}

interface AriaLocatorOptions extends AriaSnapshotOptions {
  excludeElement?: (element: Element) => boolean
  getShadowRoot?: (element: Element) => ShadowRoot | null
}

type AriaLocatorStep = AriaLabelLocatorStep | AriaRoleLocatorStep
