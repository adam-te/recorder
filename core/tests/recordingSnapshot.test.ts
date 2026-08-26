import { describe, expect, test } from 'vitest'

import { parseRecordingSnapshot } from '@te/recorder-core'

describe('recording snapshots', () => {
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
