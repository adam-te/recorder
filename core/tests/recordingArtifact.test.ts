import { describe, expect, test } from 'vitest'

import { createRecording, createRecordingArtifactStore, type RecordedAriaSnapshot, type Recording } from '@te/recorder-core'

describe('recording artifacts', () => {
  const recording: Recording = {
    ...createRecording({ createdAt: new Date('2026-01-01T00:00:00Z'), startUrl: 'https://example.com', title: 'Example recording' }),
    actions: [
      { kind: 'goto', pageUrl: 'about:blank', url: 'https://example.com' },
      { kind: 'click', locatorCandidates: [{ kind: 'aria', steps: [{ method: 'role', name: 'Save', role: 'button' }] }], pageUrl: 'https://example.com' },
    ],
  }
  const snapshot: RecordedAriaSnapshot = { children: [{ name: 'Save', props: {}, ref: 'e1', role: 'button', target: true }], name: '', props: {}, role: 'fragment' }

  test('saves and loads a complete recording artifact', async () => {
    const files = new Map<string, string>()
    const store = createRecordingArtifactStore({
      read: async path => {
        const contents = files.get(path)
        if (!contents) throw new Error(`Missing artifact file: ${path}`)
        return contents
      },
      write: async (path, contents) => {
        files.set(path, contents)
      },
    })

    await store.save({ readSnapshot: () => snapshot, recording })

    expect([...files.keys()]).toEqual(['recording.json', 'snapshots/0001.aria.json'])
    expect(await store.load()).toEqual(recording)
    expect(await store.loadSnapshot(1)).toEqual(snapshot)
  })

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
