import type { CapturedInteraction } from '#recorder-runtime/recording/installRecordingCapture/index.ts'
import { createRecordedLocatorCandidates } from '#recorder-runtime/recording/processing/createRecordedLocatorCandidates.ts'

import type { RecordedAction } from '@te/recorder-core'
import { matchBy } from '@te/recorder-utils'

export { createRecordedAction }

async function createRecordedAction(interaction: CapturedInteraction): Promise<RecordedAction | undefined> {
  return await matchBy(interaction.event, 'kind', {
    change: () => undefined,
    click: event => createClickAction({ ...interaction, event }),
    input: () => undefined,
    keydown: event => createPressAction({ ...interaction, event }),
  })

  async function createClickAction(currentInteraction: CapturedClickInteraction): Promise<RecordedAction> {
    return {
      ariaSnapshot: currentInteraction.ariaSnapshot,
      kind: 'click',
      locatorCandidates: await createRecordedLocatorCandidates(currentInteraction),
      pageUrl: currentInteraction.pageUrl,
      ...(currentInteraction.ref ? { ref: currentInteraction.ref } : {}),
    }
  }

  async function createPressAction(currentInteraction: CapturedKeydownInteraction): Promise<RecordedAction> {
    return {
      ariaSnapshot: currentInteraction.ariaSnapshot,
      key: currentInteraction.event.key,
      kind: 'press',
      locatorCandidates: await createRecordedLocatorCandidates(currentInteraction),
      pageUrl: currentInteraction.pageUrl,
      ...(currentInteraction.ref ? { ref: currentInteraction.ref } : {}),
    }
  }
}

type CapturedClickInteraction = CapturedInteraction & { event: Extract<CapturedInteraction['event'], { kind: 'click' }> }
type CapturedKeydownInteraction = CapturedInteraction & { event: Extract<CapturedInteraction['event'], { kind: 'keydown' }> }
