import type { CapturedInteraction } from '#recorder-runtime/recording/installRecordingCapture/index.ts'
import { createRecordedLocatorCandidates } from '#recorder-runtime/recording/processing/createRecordedLocatorCandidates.ts'

import { parseRecordingSnapshot, type RecordedAction, type RecordedAriaNode, type RecordedAriaSnapshot } from '@te/recorder-core'
import { matchBy } from '@te/recorder-utils'

export { createRecordedAction }

async function createRecordedAction(interaction: CapturedInteraction): Promise<RecordedInteraction | undefined> {
  return await matchBy(interaction.event, 'kind', {
    change: () => undefined,
    click: event => createClickAction({ ...interaction, event }),
    input: () => undefined,
    keydown: event => createPressAction({ ...interaction, event }),
  })

  async function createClickAction(currentInteraction: CapturedClickInteraction): Promise<RecordedInteraction> {
    return {
      action: { kind: 'click', locatorCandidates: await createRecordedLocatorCandidates(currentInteraction), pageUrl: currentInteraction.pageUrl },
      ariaSnapshot: markSnapshotTarget(currentInteraction.ariaSnapshot, currentInteraction.targetRef),
    }
  }

  async function createPressAction(currentInteraction: CapturedKeydownInteraction): Promise<RecordedInteraction> {
    return {
      action: { key: currentInteraction.event.key, kind: 'press', locatorCandidates: await createRecordedLocatorCandidates(currentInteraction), pageUrl: currentInteraction.pageUrl },
      ariaSnapshot: markSnapshotTarget(currentInteraction.ariaSnapshot, currentInteraction.targetRef),
    }
  }
}

function markSnapshotTarget(snapshot: RecordedAriaSnapshot, targetRef: string | undefined): RecordedAriaSnapshot {
  const markedSnapshot = markNode(snapshot)

  return parseRecordingSnapshot(markedSnapshot)

  function markNode(node: RecordedAriaNode): RecordedAriaNode {
    return {
      ...node,
      ...(targetRef !== undefined && node.ref === targetRef ? { target: true as const } : {}),
      ...(node.children ? { children: node.children.map(child => (typeof child === 'string' ? child : markNode(child))) } : {}),
    }
  }
}

type CapturedClickInteraction = CapturedInteraction & { event: Extract<CapturedInteraction['event'], { kind: 'click' }> }
type CapturedKeydownInteraction = CapturedInteraction & { event: Extract<CapturedInteraction['event'], { kind: 'keydown' }> }

interface RecordedInteraction {
  action: RecordedAction
  ariaSnapshot: RecordedAriaSnapshot
}
