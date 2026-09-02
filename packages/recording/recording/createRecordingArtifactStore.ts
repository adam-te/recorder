import { parseRecording } from '#recording/recording/parseRecording.ts'
import type { RecordedAriaSnapshot, Recording } from '#recording/recording/recordingSchema.ts'
import { getRecordingScreenshotFileName, getRecordingSnapshotFileName, parseRecordingSnapshot, serializeRecordingSnapshot } from '#recording/recording/recordingSnapshot.ts'
import { serializeRecording } from '#recording/recording/serializeRecording.ts'

export { createRecordingArtifactStore, RECORDING_DOCUMENT_PATH }
export type { RecordingArtifact, RecordingArtifactStore }

const RECORDING_DOCUMENT_PATH = 'recording.json'

function createRecordingArtifactStore(config: CreateRecordingArtifactStoreArgs): RecordingArtifactStore {
  return { load, loadScreenshot, loadSnapshot, save, saveRecording }

  async function load(): Promise<Recording> {
    return parseRecording(JSON.parse(await config.read(RECORDING_DOCUMENT_PATH)))
  }

  async function loadSnapshot(actionIndex: number): Promise<RecordedAriaSnapshot> {
    return parseRecordingSnapshot(JSON.parse(await config.read(getSnapshotPath(actionIndex))))
  }

  async function loadScreenshot(actionIndex: number): Promise<Uint8Array> {
    return await config.readBinary(getScreenshotPath(actionIndex))
  }

  async function save(artifact: RecordingArtifact): Promise<void> {
    const recording = parseRecording(artifact.recording)
    const snapshots = await Promise.all(
      recording.actions.flatMap((action, actionIndex) => ('locatorCandidates' in action ? [Promise.all([artifact.readSnapshot(actionIndex), artifact.readScreenshot(actionIndex)]).then(([snapshot, screenshot]) => ({ actionIndex, screenshot, snapshot: parseRecordingSnapshot(snapshot) }))] : [])),
    )

    await saveRecording(recording)
    for (const snapshot of snapshots) await Promise.all([saveSnapshot(snapshot), saveScreenshot(snapshot)])

    await load()
    await Promise.all(snapshots.flatMap(snapshot => [loadSnapshot(snapshot.actionIndex), loadScreenshot(snapshot.actionIndex)]))
  }

  async function saveRecording(recording: Recording): Promise<void> {
    await config.write(RECORDING_DOCUMENT_PATH, serializeRecording(recording))
  }

  async function saveSnapshot(args: SaveRecordingSnapshotArgs): Promise<void> {
    await config.write(getSnapshotPath(args.actionIndex), serializeRecordingSnapshot(args.snapshot))
  }

  async function saveScreenshot(args: SaveRecordingSnapshotArgs): Promise<void> {
    await config.writeBinary(getScreenshotPath(args.actionIndex), args.screenshot)
  }
}

function getScreenshotPath(actionIndex: number): string {
  return `snapshots/${getRecordingScreenshotFileName(actionIndex)}`
}

function getSnapshotPath(actionIndex: number): string {
  return `snapshots/${getRecordingSnapshotFileName(actionIndex)}`
}

interface CreateRecordingArtifactStoreArgs {
  read: (relativePath: string) => Promise<string>
  readBinary: (relativePath: string) => Promise<Uint8Array>
  write: (relativePath: string, contents: string) => Promise<void>
  writeBinary: (relativePath: string, contents: Uint8Array) => Promise<void>
}

interface RecordingArtifact {
  readScreenshot: (actionIndex: number) => Promise<Uint8Array> | Uint8Array
  readSnapshot: (actionIndex: number) => Promise<RecordedAriaSnapshot> | RecordedAriaSnapshot
  recording: Recording
}

interface SaveRecordingSnapshotArgs {
  actionIndex: number
  screenshot: Uint8Array
  snapshot: RecordedAriaSnapshot
}

interface RecordingArtifactStore {
  load: () => Promise<Recording>
  loadScreenshot: (actionIndex: number) => Promise<Uint8Array>
  loadSnapshot: (actionIndex: number) => Promise<RecordedAriaSnapshot>
  save: (artifact: RecordingArtifact) => Promise<void>
  saveRecording: (recording: Recording) => Promise<void>
}
