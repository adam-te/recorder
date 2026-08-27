import { describe, expect, test } from 'vitest'

import { createRecording, createRecordingArtifactStore, type Recording } from '@te/recorder-core'

describe('recording artifacts', () => {
  const recording: Recording = {
    ...createRecording({ createdAt: new Date('2026-01-01T00:00:00Z'), startUrl: 'https://example.com', title: 'Example recording' }),
    actions: [
      { kind: 'goto', pageUrl: 'about:blank', url: 'https://example.com' },
      { kind: 'click', locatorCandidates: [{ kind: 'aria', steps: [{ method: 'role', name: 'Save', role: 'button' }] }], pageUrl: 'https://example.com' },
    ],
  }
  test('rejects an incomplete artifact before writing it', async () => {
    const files = new Map<string, string>()
    const store = createRecordingArtifactStore({
      read: async path => files.get(path) ?? '',
      write: async (path, contents) => {
        files.set(path, contents)
      },
    })

    await expect(
      store.save({
        readSnapshot: () => {
          throw new Error('Snapshot is unavailable.')
        },
        recording,
      }),
    ).rejects.toThrow('Snapshot is unavailable.')
    expect(files.size).toBe(0)
  })
})
