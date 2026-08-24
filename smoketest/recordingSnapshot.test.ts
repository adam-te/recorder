import { describe, expect, test } from 'vitest'

import { getRecordingSnapshotFileName, parseRecordingSnapshot, serializeRecordingSnapshot } from '@te/recorder-core'

describe('recording snapshots', () => {
  test('uses zero-padded action indexes as file names', () => {
    expect(getRecordingSnapshotFileName(0)).toBe('0000.aria.json')
    expect(getRecordingSnapshotFileName(42)).toBe('0042.aria.json')
  })

  test('round trips a snapshot with one target', () => {
    const snapshot = parseRecordingSnapshot({ children: [{ name: 'Save', props: {}, role: 'button', target: true }], name: '', props: {}, role: 'fragment' })

    expect(parseRecordingSnapshot(JSON.parse(serializeRecordingSnapshot(snapshot)))).toStrictEqual(snapshot)
  })

  test('rejects snapshots with multiple targets', () => {
    expect(() =>
      parseRecordingSnapshot({
        children: [
          { name: 'Save', props: {}, role: 'button', target: true },
          { name: 'Cancel', props: {}, role: 'button', target: true },
        ],
        name: '',
        props: {},
        role: 'fragment',
      }),
    ).toThrow('An ARIA snapshot cannot contain more than one target.')
  })
})
