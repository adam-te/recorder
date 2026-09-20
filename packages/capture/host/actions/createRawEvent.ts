import { createRecordedLocatorCandidates } from '#capture/host/locators/createRecordedLocatorCandidates.ts'
import type { CapturedInteraction } from '#capture/host/types.ts'

import { parseRecordingSnapshot, type RawEvent, type RecordedAriaNode, type RecordedAriaSnapshot } from '@te/recorder-recording'
import { matchBy } from '@te/recorder-utils'

export { createRawEvent }

async function createRawEvent(interaction: CapturedInteraction): Promise<RawInteraction> {
  return await matchBy(interaction.event, 'kind', {
    click: event => createClickEvent({ ...interaction, event }),
    keydown: event => createPressEvent({ ...interaction, event }),
  })

  async function createClickEvent(currentInteraction: CapturedClickInteraction): Promise<RawInteraction> {
    return {
      event: { kind: 'click', locatorCandidates: await createRecordedLocatorCandidates(currentInteraction), pageUrl: currentInteraction.pageUrl },
      ariaSnapshot: markSnapshotTarget(currentInteraction.ariaSnapshot, currentInteraction.targetRef),
    }
  }

  async function createPressEvent(currentInteraction: CapturedKeydownInteraction): Promise<RawInteraction> {
    return {
      event: {
        ...(currentInteraction.event.inputValue !== undefined ? { inputValue: currentInteraction.event.inputValue } : {}),
        key: currentInteraction.event.key,
        kind: 'key-press',
        locatorCandidates: await createRecordedLocatorCandidates(currentInteraction),
        ...(currentInteraction.event.modifiers?.length ? { modifiers: currentInteraction.event.modifiers } : {}),
        pageUrl: currentInteraction.pageUrl,
      },
      ariaSnapshot: markSnapshotTarget(currentInteraction.ariaSnapshot, currentInteraction.targetRef),
    }
  }
}

function markSnapshotTarget(snapshot: RecordedAriaSnapshot, targetRef: string | undefined): RecordedAriaSnapshot {
  return parseRecordingSnapshot(markNode(snapshot))

  function markNode(node: RecordedAriaNode): RecordedAriaNode {
    return {
      ...node,
      ...(targetRef && node.ref === targetRef ? { target: true as const } : {}),
      ...(node.children ? { children: node.children.map(child => (typeof child === 'string' ? child : markNode(child))) } : {}),
    }
  }
}

type CapturedClickInteraction = CapturedInteraction & { event: Extract<CapturedInteraction['event'], { kind: 'click' }> }
type CapturedKeydownInteraction = CapturedInteraction & { event: Extract<CapturedInteraction['event'], { kind: 'keydown' }> }

interface RawInteraction {
  ariaSnapshot: RecordedAriaSnapshot
  event: RawEvent
}
