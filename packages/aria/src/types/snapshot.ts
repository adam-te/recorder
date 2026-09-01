import type { AriaNode as PlaywrightAriaNode } from '#aria/vendor/playwright/isomorphic/ariaSnapshot.ts'

export type { AriaNode, AriaSnapshot }

interface AriaNode extends Omit<PlaywrightAriaNode, 'box' | 'children' | 'receivesPointerEvents'> {
  children?: (AriaNode | string)[]
  cursor?: 'pointer'
}

type AriaSnapshot = AriaNode
