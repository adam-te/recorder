import type { CapturedInteractionEvent, CapturedSelector, SerializedInteraction } from '#runtime/injected/protocol.ts'
import type { Frame } from 'playwright'

export type { CapturedInteraction, CapturedInteractionEvent, CapturedSelector }

interface CapturedInteraction extends SerializedInteraction {
  frame: Frame
  pageUrl: string
}
