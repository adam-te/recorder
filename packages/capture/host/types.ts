import type { CapturedInteractionEvent, CapturedSelector, SerializedInteraction } from '#capture/protocol.ts'
import type { Frame, Page } from 'playwright'

export type { CapturedInteraction, CapturedInteractionEvent, CapturedSelector }

interface CapturedInteraction extends SerializedInteraction {
  frame: Frame
  page: Page
  pageUrl: string
}
