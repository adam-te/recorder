import { parseRecording } from '#core/recording/parseRecording.ts'
import type { RecordedAriaSnapshot, Recording } from '#core/recording/recordingSchema.ts'
import { getRecordingSnapshotFileName, parseRecordingSnapshot, serializeRecordingSnapshot } from '#core/recording/recordingSnapshot.ts'
import { serializeRecording } from '#core/recording/serializeRecording.ts'

export { createRecordingArtifactStore, RECORDING_DOCUMENT_PATH }
export type { RecordingArtifact, RecordingArtifactStore }

const RECORDING_DOCUMENT_PATH = 'recording.json'

function createRecordingArtifactStore(config: CreateRecordingArtifactStoreArgs): RecordingArtifactStore {
  return { load, loadSnapshot, save }

  async function load(): Promise<Recording> {
    return parseRecording(JSON.parse(await config.read(RECORDING_DOCUMENT_PATH)))
  }

  async function loadSnapshot(actionIndex: number): Promise<RecordedAriaSnapshot> {
    return parseRecordingSnapshot(JSON.parse(await config.read(getSnapshotPath(actionIndex))))
  }

  async function save(artifact: RecordingArtifact): Promise<void> {
    const recording = parseRecording(artifact.recording)
    const snapshots = await Promise.all(
      recording.actions.flatMap((action, actionIndex) =>
        'locatorCandidates' in action
          ? [
              Promise.resolve(artifact.readSnapshot(actionIndex)).then(snapshot => ({
                actionIndex,
                snapshot: parseRecordingSnapshot(snapshot),
              })),
            ]
          : [],
      ),
    )

    await saveRecording(recording)
    for (const snapshot of snapshots) await saveSnapshot(snapshot)

    await load()
    await Promise.all(snapshots.map(snapshot => loadSnapshot(snapshot.actionIndex)))
  }

  async function saveRecording(recording: Recording): Promise<void> {
    await config.write(RECORDING_DOCUMENT_PATH, serializeRecording(recording))
  }

  async function saveSnapshot(args: SaveRecordingSnapshotArgs): Promise<void> {
    await config.write(getSnapshotPath(args.actionIndex), serializeRecordingSnapshot(args.snapshot))
  }
}

function getSnapshotPath(actionIndex: number): string {
  return `snapshots/${getRecordingSnapshotFileName(actionIndex)}`
}

interface CreateRecordingArtifactStoreArgs {
  read: (relativePath: string) => Promise<string>
  write: (relativePath: string, contents: string) => Promise<void>
}

interface RecordingArtifact {
  readSnapshot: (actionIndex: number) => Promise<RecordedAriaSnapshot> | RecordedAriaSnapshot
  recording: Recording
}

interface SaveRecordingSnapshotArgs {
  actionIndex: number
  snapshot: RecordedAriaSnapshot
}

interface RecordingArtifactStore {
  load: () => Promise<Recording>
  loadSnapshot: (actionIndex: number) => Promise<RecordedAriaSnapshot>
  save: (artifact: RecordingArtifact) => Promise<void>
}
