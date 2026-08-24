import { renderAriaSnapshot } from '@te/aria'

import type { RecordedAriaNode, RecordedAriaSnapshot } from '@te/recorder-core'

export { renderRecordingSnapshot }
export type { RenderedRecordingSnapshot }

function renderRecordingSnapshot(snapshot: RecordedAriaSnapshot): RenderedRecordingSnapshot {
  const lines = renderAriaSnapshot(snapshot).split('\n')
  const targetRef = findTarget(snapshot)?.ref
  const targetMarker = targetRef ? `[ref=${targetRef}]` : undefined
  const targetLine = targetMarker ? lines.findIndex(line => [targetMarker, `${targetMarker}:`, `${targetMarker} [cursor=pointer]`, `${targetMarker} [cursor=pointer]:`].some(suffix => line.endsWith(suffix))) : -1
  const yaml = lines.map(line => line.replace(/ \[ref=[^\]\r\n]+\](?=(?: \[cursor=pointer\])?:?$)/, '')).join('\n')

  return { yaml, ...(targetLine >= 0 ? { targetLine } : {}) }
}

function findTarget(node: RecordedAriaNode): RecordedAriaNode | undefined {
  if (node.target) return node

  for (const child of node.children ?? []) {
    if (typeof child !== 'string') {
      const target = findTarget(child)
      if (target) return target
    }
  }

  return undefined
}

interface RenderedRecordingSnapshot {
  targetLine?: number
  yaml: string
}
