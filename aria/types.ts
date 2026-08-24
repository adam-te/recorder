import type { AriaNode as PlaywrightAriaNode } from './vendor/playwright/isomorphic/ariaSnapshot.ts'

export type { AriaLocatorCandidate, AriaLocatorOptions, AriaLocatorStep, AriaNode, AriaRuntime, AriaSnapshot, AriaSnapshotOptions, GeneratedAriaSnapshot }

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
  generateAriaSnapshot: (options: AriaSnapshotOptions) => GeneratedAriaSnapshot
  renderAriaSnapshot: (snapshot: AriaSnapshot) => string
}

interface GeneratedAriaSnapshot {
  snapshot: AriaSnapshot
  targetRef?: string
}

interface AriaNode extends Omit<PlaywrightAriaNode, 'box' | 'children' | 'receivesPointerEvents'> {
  children?: (AriaNode | string)[]
  cursor?: 'pointer'
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
type AriaSnapshot = AriaNode
