import { describe, expect, test } from 'vitest'

import { createRecording, createRecordingArtifactStore, type Recording, type RecordingArtifactStore } from '@te/recorder-recording'

describe('recording artifacts', () => {
  const recording: Recording = {
    ...createRecording({ createdAt: new Date('2026-01-01T00:00:00Z'), startUrl: 'https://example.com', title: 'Example recording' }),
    events: [
      { kind: 'goto', pageUrl: 'about:blank', url: 'https://example.com' },
      { kind: 'click', locatorCandidates: [{ kind: 'aria', steps: [{ method: 'role', name: 'Save', role: 'button' }] }], pageUrl: 'https://example.com' },
    ],
  }
  test('rejects an incomplete capture before writing it', async () => {
    const { files, store } = createMemoryStore()

    await expect(store.saveCapture({ events: recording.events.map(event => ({ event })), metadata: { createdAt: recording.createdAt, startUrl: recording.startUrl, title: recording.title } })).rejects.toThrow('Missing preview')
    expect(files.size).toBe(0)
  })

  test('keeps action previews aligned by allowing only annotation updates', async () => {
    const { store } = createMemoryStore()
    await store.saveCapture({
      events: [{ event: recording.events[0] }, { event: recording.events[1], preview: { screenshot: Uint8Array.from([1]), snapshot: { name: 'Save', props: {}, role: 'button', target: true } } }],
      metadata: { createdAt: recording.createdAt, startUrl: recording.startUrl, title: recording.title },
    })
    const steps = await store.loadSteps()
    const annotatedSteps = [{ kind: 'marker-start' as const, name: 'Save' }, ...steps, { kind: 'marker-end' as const, name: 'Save' }]

    await store.saveStepAnnotations(annotatedSteps)
    await expect(store.saveStepAnnotations(annotatedSteps.map(step => (step.kind === 'goto' ? { ...step, url: 'https://example.com/changed' } : step)))).rejects.toThrow('Only marker and screenshot steps can be changed')
    expect(await store.loadSteps()).toStrictEqual(annotatedSteps)
  })
})

function createMemoryStore(): { files: Map<string, Uint8Array | string>; store: RecordingArtifactStore } {
  const files = new Map<string, Uint8Array | string>()

  return {
    files,
    store: createRecordingArtifactStore({
      read: async path => String(files.get(path) ?? ''),
      readBinary: async path => files.get(path) as Uint8Array,
      write: async (path, contents) => {
        files.set(path, contents)
      },
      writeBinary: async (path, contents) => {
        files.set(path, contents)
      },
    }),
  }
}
