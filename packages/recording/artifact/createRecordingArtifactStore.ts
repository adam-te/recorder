import { parseRecording, serializeRecording } from '#recording/recording/recording.ts'
import type { RawEvent, Recording, RecordingMetadata } from '#recording/recording/recordingSchema.ts'
import type { RecordedAriaSnapshot } from '#recording/shared/recordedDataSchema.ts'
import { projectRecordingEvents } from '#recording/steps/deriveRecordingSteps.ts'
import { validateStepAnnotationUpdate } from '#recording/steps/recordingStepAnnotations.ts'
import { getActionSteps, parseRecordingSteps, serializeRecordingSteps } from '#recording/steps/recordingSteps.ts'
import { recordingStepsSchema, type RecordingSteps } from '#recording/steps/recordingStepsSchema.ts'

import { getRecordingScreenshotFileName, getRecordingSnapshotFileName, parseRecordingSnapshot, serializeRecordingSnapshot } from './recordingSnapshot.ts'

export { createRecordingArtifactStore, RECORDING_DOCUMENT_PATH, STEPS_DOCUMENT_PATH }
export type { CapturedPreview, CapturedRawEvent, CapturedRecording, RecordingArtifactReader, RecordingArtifactStore }

const RECORDING_DOCUMENT_PATH = 'recording.json'
const STEPS_DOCUMENT_PATH = 'steps.json'

function createRecordingArtifactStore(config: CreateRecordingArtifactStoreArgs): RecordingArtifactStore {
  return { copyFrom, loadRecording, loadScreenshot, loadSnapshot, loadSteps, saveCapture, saveStepAnnotations }

  async function loadRecording(): Promise<Recording> {
    return parseRecording(JSON.parse(await config.read(RECORDING_DOCUMENT_PATH)))
  }

  async function loadSteps(): Promise<RecordingSteps> {
    return parseRecordingSteps(JSON.parse(await config.read(STEPS_DOCUMENT_PATH)))
  }

  async function loadSnapshot(actionIndex: number): Promise<RecordedAriaSnapshot> {
    return parseRecordingSnapshot(JSON.parse(await config.read(getSnapshotPath(actionIndex))))
  }

  async function loadScreenshot(actionIndex: number): Promise<Uint8Array> {
    return await config.readBinary(getScreenshotPath(actionIndex))
  }

  async function saveCapture(capture: CapturedRecording): Promise<void> {
    const recording = parseRecording({ ...capture.metadata, events: capture.events.map(({ event }) => event) })
    const projections = projectRecordingEvents(capture.events)
    const steps = recordingStepsSchema.parse(projections.map(projection => projection.step))
    const previews = projections.flatMap(({ source, step }, actionIndex) => {
      if (!('locatorCandidates' in step)) return []
      if (!source.preview) throw new Error(`Missing preview for captured ${source.event.kind} event.`)

      return [{ actionIndex, screenshot: source.preview.screenshot, snapshot: parseRecordingSnapshot(source.preview.snapshot) }]
    })

    await saveArtifact({ previews, recording, steps })
  }

  async function copyFrom(source: RecordingArtifactReader): Promise<void> {
    const [recording, steps] = await Promise.all([source.loadRecording(), source.loadSteps()])
    const previews = await Promise.all(
      getActionSteps(steps).flatMap((step, actionIndex) => ('locatorCandidates' in step ? [Promise.all([source.loadSnapshot(actionIndex), source.loadScreenshot(actionIndex)]).then(([snapshot, screenshot]) => ({ actionIndex, screenshot, snapshot: parseRecordingSnapshot(snapshot) }))] : [])),
    )

    await saveArtifact({ previews, recording, steps })
  }

  async function saveArtifact(args: { previews: SaveRecordingPreviewArgs[]; recording: Recording; steps: RecordingSteps }): Promise<void> {
    await Promise.all([config.write(RECORDING_DOCUMENT_PATH, serializeRecording(args.recording)), config.write(STEPS_DOCUMENT_PATH, serializeRecordingSteps(args.steps))])
    for (const preview of args.previews) await Promise.all([saveSnapshot(preview), saveScreenshot(preview)])
    await verify(args.previews)
  }

  async function saveStepAnnotations(steps: RecordingSteps): Promise<void> {
    await config.write(STEPS_DOCUMENT_PATH, serializeRecordingSteps(validateStepAnnotationUpdate(await loadSteps(), steps)))
  }

  async function saveSnapshot(args: SaveRecordingPreviewArgs): Promise<void> {
    await config.write(getSnapshotPath(args.actionIndex), serializeRecordingSnapshot(args.snapshot))
  }

  async function saveScreenshot(args: SaveRecordingPreviewArgs): Promise<void> {
    await config.writeBinary(getScreenshotPath(args.actionIndex), args.screenshot)
  }

  async function verify(previews: SaveRecordingPreviewArgs[]): Promise<void> {
    await Promise.all([loadRecording(), loadSteps(), ...previews.flatMap(preview => [loadSnapshot(preview.actionIndex), loadScreenshot(preview.actionIndex)])])
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

interface CapturedPreview {
  readonly screenshot: Uint8Array
  readonly snapshot: RecordedAriaSnapshot
}

interface CapturedRawEvent {
  readonly event: RawEvent
  readonly preview?: CapturedPreview
}

interface CapturedRecording {
  readonly events: readonly CapturedRawEvent[]
  readonly metadata: RecordingMetadata
}

interface RecordingArtifactReader {
  loadRecording: () => Promise<Recording>
  loadScreenshot: (actionIndex: number) => Promise<Uint8Array>
  loadSnapshot: (actionIndex: number) => Promise<RecordedAriaSnapshot>
  loadSteps: () => Promise<RecordingSteps>
}

interface SaveRecordingPreviewArgs extends CapturedPreview {
  actionIndex: number
}

interface RecordingArtifactStore extends RecordingArtifactReader {
  copyFrom: (source: RecordingArtifactReader) => Promise<void>
  saveCapture: (capture: CapturedRecording) => Promise<void>
  saveStepAnnotations: (steps: RecordingSteps) => Promise<void>
}
