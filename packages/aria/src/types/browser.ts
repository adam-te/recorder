import type { AriaLocatorCandidate } from './locators.ts'
import type { AriaSnapshot } from './snapshot.ts'

export type { AriaLocatorOptions, AriaRuntime, AriaSnapshotOptions, GeneratedAriaSnapshot }

interface AriaRuntime {
  generateAriaLocatorCandidates: (options: AriaLocatorOptions) => AriaLocatorCandidate[]
  generateAriaSnapshot: (options: AriaSnapshotOptions) => GeneratedAriaSnapshot
}

interface GeneratedAriaSnapshot {
  snapshot: AriaSnapshot
  targetRef?: string
}

interface AriaSnapshotOptions {
  target: Element
  targetPath?: Element[]
}

interface AriaLocatorOptions {
  excludeElement?: (element: Element) => boolean
  getShadowRoot?: (element: Element) => ShadowRoot | null
  target: Element
}
