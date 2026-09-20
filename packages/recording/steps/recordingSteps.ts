import type { ActionStep } from './actionStepSchema.ts'
import { recordingStepsSchema, type AnnotationStep, type RecordingStep, type RecordingSteps } from './recordingStepsSchema.ts'

export { getActionSteps, isActionStep, parseRecordingSteps, serializeRecordingSteps }

function parseRecordingSteps(value: unknown): RecordingSteps {
  return recordingStepsSchema.parse(value)
}

function serializeRecordingSteps(steps: RecordingSteps): string {
  return `${JSON.stringify(recordingStepsSchema.parse(steps), undefined, 2)}\n`
}

function isActionStep(step: RecordingStep): step is ActionStep {
  return !isAnnotationStep(step)
}

function getActionSteps(steps: RecordingSteps): ActionStep[] {
  return steps.filter(isActionStep)
}

function isAnnotationStep(step: RecordingStep): step is AnnotationStep {
  return step.kind === 'marker-start' || step.kind === 'marker-end' || step.kind === 'screenshot'
}
