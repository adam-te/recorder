import { parseRecording } from '#recording/recording/recording.ts'
import type { RawEvent, Recording } from '#recording/recording/recordingSchema.ts'
import type { RecordedLocator } from '#recording/shared/recordedDataSchema.ts'

import { matchBy } from '@te/recorder-utils'

import type { ActionStep } from './actionStepSchema.ts'
import { recordingStepsSchema, type RecordingSteps } from './recordingStepsSchema.ts'

export { deriveRecordingSteps, projectRecordingEvents }

function deriveRecordingSteps(value: Recording): RecordingSteps {
  return recordingStepsSchema.parse(projectRecordingEvents(parseRecording(value).events.map(event => ({ event }))).map(({ step }) => step))
}

function projectRecordingEvents<Source extends RecordingEventSource>(sources: readonly Source[]): ProjectedRecordingStep<Source>[] {
  const steps: ProjectedRecordingStep<Source>[] = []

  for (let eventIndex = 0; eventIndex < sources.length; ) {
    const fill = findFill(sources, eventIndex)

    if (fill) {
      steps.push({ source: fill.source, step: { kind: 'fill', locatorCandidates: fill.event.locatorCandidates, pageUrl: fill.event.pageUrl, value: { kind: 'plain-text', value: fill.event.inputValue } } })
      eventIndex = fill.end
      continue
    }

    steps.push({ source: sources[eventIndex], step: deriveActionStep(sources[eventIndex].event) })
    eventIndex += 1
  }

  return steps
}

function findFill<Source extends RecordingEventSource>(sources: readonly Source[], start: number): FillProjection<Source> | undefined {
  const first = sources[start]?.event
  if (!isFillCandidate(first)) return

  let fill: FillProjection<Source> | undefined

  for (let eventIndex = start; eventIndex < sources.length; eventIndex += 1) {
    const event = sources[eventIndex].event

    if (!isFillCandidate(event) || !sameTarget(first, event)) break
    if (hasInputValue(event)) fill = { end: eventIndex + 1, event, source: sources[eventIndex] }
  }

  return fill
}

function deriveActionStep(event: RawEvent): ActionStep {
  return matchBy(event, 'kind', {
    click: current => current,
    goto: current => current,
    'key-press': current => ({ key: current.key, kind: 'press' as const, locatorCandidates: current.locatorCandidates, ...(current.modifiers?.length ? { modifiers: current.modifiers } : {}), pageUrl: current.pageUrl }),
  })
}

function isFillCandidate(event: RawEvent | undefined): event is KeyPressEvent {
  return Boolean(event?.kind === 'key-press' && (event.inputValue !== undefined || modifierKeys.has(event.key)))
}

function hasInputValue(event: KeyPressEvent): event is InputKeyPressEvent {
  return event.inputValue !== undefined
}

function sameTarget(left: KeyPressEvent, right: KeyPressEvent): boolean {
  return left.pageUrl === right.pageUrl && left.locatorCandidates.length === right.locatorCandidates.length && left.locatorCandidates.every((locator, index) => sameLocator(locator, right.locatorCandidates[index]))
}

function sameLocator(left: RecordedLocator, right: RecordedLocator): boolean {
  if (!sameStrings(left.framePath, right.framePath)) return false

  return matchBy(left, 'kind', {
    aria: current => right.kind === 'aria' && current.steps.length === right.steps.length && current.steps.every((step, index) => sameAriaStep(step, right.steps[index])),
    css: current => right.kind === 'css' && current.value === right.value,
    'test-id': current => right.kind === 'test-id' && current.value === right.value,
  })
}

function sameAriaStep(left: AriaLocatorStep, right: AriaLocatorStep): boolean {
  if (left.method !== right.method || Boolean(left.exact) !== Boolean(right.exact)) return false

  return matchBy(left, 'method', {
    alt: current => right.method === 'alt' && current.text === right.text,
    label: current => right.method === 'label' && current.text === right.text,
    placeholder: current => right.method === 'placeholder' && current.text === right.text,
    role: current => right.method === 'role' && current.name === right.name && current.role === right.role,
    text: current => right.method === 'text' && current.text === right.text,
    title: current => right.method === 'title' && current.text === right.text,
  })
}

function sameStrings(left: string[] | undefined, right: string[] | undefined): boolean {
  return (left?.length ?? 0) === (right?.length ?? 0) && (left ?? []).every((value, index) => value === right?.[index])
}

const modifierKeys = new Set(['Alt', 'Control', 'Meta', 'Shift'])

type KeyPressEvent = Extract<RawEvent, { kind: 'key-press' }>
type InputKeyPressEvent = KeyPressEvent & { inputValue: string }
type AriaLocatorStep = Extract<RecordedLocator, { kind: 'aria' }>['steps'][number]

interface RecordingEventSource {
  event: RawEvent
}

interface FillProjection<Source extends RecordingEventSource> {
  end: number
  event: InputKeyPressEvent
  source: Source
}

interface ProjectedRecordingStep<Source extends RecordingEventSource> {
  source: Source
  step: ActionStep
}
