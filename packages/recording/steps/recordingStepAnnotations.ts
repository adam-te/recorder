import { getActionSteps, isActionStep, parseRecordingSteps, serializeRecordingSteps } from './recordingSteps.ts'
import type { AnnotationStep, RecordingSteps } from './recordingStepsSchema.ts'

export { insertAnnotationStep, readStepAnnotations, removeMarkerSteps, renameMarkerSteps, validateStepAnnotationUpdate }
export type { StepAnnotations, StepMarker, StepScreenshot }

function readStepAnnotations(steps: RecordingSteps): StepAnnotations {
  const openMarkers = new Map<string, { start: number; startStepIndex: number }>()
  const markers: StepMarker[] = []
  const screenshots: StepScreenshot[] = []
  let actionBoundary = 0

  steps.forEach((step, stepIndex) => {
    if (isActionStep(step)) {
      actionBoundary += 1
      return
    }
    if (step.kind === 'marker-start') {
      openMarkers.set(step.name, { start: actionBoundary, startStepIndex: stepIndex })
      return
    }
    if (step.kind === 'screenshot') {
      screenshots.push({ at: actionBoundary, stepIndex })
      return
    }

    const start = openMarkers.get(step.name)
    if (!start) return

    openMarkers.delete(step.name)
    markers.push({ ...start, end: actionBoundary, endStepIndex: stepIndex, name: step.name })
  })

  return { markers, screenshots }
}

function insertAnnotationStep(steps: RecordingSteps, boundary: number, step: AnnotationStep): RecordingSteps {
  let actionCount = 0
  let boundaryStart = 0

  while (boundaryStart < steps.length && actionCount < boundary) {
    if (isActionStep(steps[boundaryStart])) actionCount += 1
    boundaryStart += 1
  }

  let insertionIndex = boundaryStart
  while (insertionIndex < steps.length) {
    const currentStep = steps[insertionIndex]

    if (isActionStep(currentStep) || annotationPriority(currentStep) > annotationPriority(step)) break
    insertionIndex += 1
  }

  return [...steps.slice(0, insertionIndex), step, ...steps.slice(insertionIndex)]
}

function removeMarkerSteps(steps: RecordingSteps, marker: StepMarker): RecordingSteps {
  return steps.filter((_, stepIndex) => stepIndex !== marker.startStepIndex && stepIndex !== marker.endStepIndex)
}

function renameMarkerSteps(steps: RecordingSteps, marker: StepMarker, name: string): RecordingSteps {
  return steps.map((step, stepIndex) => (stepIndex === marker.startStepIndex || stepIndex === marker.endStepIndex ? { ...step, name } : step))
}

function validateStepAnnotationUpdate(currentValue: RecordingSteps, updatedValue: unknown): RecordingSteps {
  const currentSteps = parseRecordingSteps(currentValue)
  const updatedSteps = parseRecordingSteps(updatedValue)

  if (serializeRecordingSteps(getActionSteps(currentSteps)) !== serializeRecordingSteps(getActionSteps(updatedSteps))) throw new Error('Only marker and screenshot steps can be changed.')

  return updatedSteps
}

function annotationPriority(step: AnnotationStep): number {
  if (step.kind === 'marker-end') return 0
  if (step.kind === 'screenshot') return 1
  return 2
}

interface StepAnnotations {
  markers: StepMarker[]
  screenshots: StepScreenshot[]
}

interface StepMarker {
  end: number
  endStepIndex: number
  name: string
  start: number
  startStepIndex: number
}

interface StepScreenshot {
  at: number
  stepIndex: number
}
