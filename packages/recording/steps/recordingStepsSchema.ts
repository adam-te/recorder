import { z } from 'zod'

import { actionStepSchema, type ActionStep } from './actionStepSchema.ts'

export { recordingStepsSchema }
export type { AnnotationStep, MarkerEndStep, MarkerStartStep, RecordingStep, RecordingSteps, ScreenshotStep }

const markerStartStepSchema = z.object({ kind: z.literal('marker-start'), name: z.string().min(1) })
const markerEndStepSchema = z.object({ kind: z.literal('marker-end'), name: z.string().min(1) })
const screenshotStepSchema = z.object({ kind: z.literal('screenshot') })
const annotationStepSchema = z.discriminatedUnion('kind', [markerStartStepSchema, markerEndStepSchema, screenshotStepSchema])
const recordingStepSchema = z.union([actionStepSchema, annotationStepSchema])
const recordingStepsSchema = z.array(recordingStepSchema).superRefine((steps, context) => {
  const openMarkers = new Map<string, number>()
  const closedMarkers = new Set<string>()

  steps.forEach((step, stepIndex) => {
    if (step.kind === 'marker-start') {
      if (openMarkers.has(step.name) || closedMarkers.has(step.name)) context.addIssue({ code: 'custom', message: 'Marker names must be unique.', path: [stepIndex, 'name'] })
      else openMarkers.set(step.name, stepIndex)
      return
    }

    if (step.kind !== 'marker-end') return
    if (!openMarkers.delete(step.name)) context.addIssue({ code: 'custom', message: 'A marker end must follow its matching marker start.', path: [stepIndex] })
    else closedMarkers.add(step.name)
  })

  openMarkers.forEach(stepIndex => context.addIssue({ code: 'custom', message: 'A marker start must have a matching marker end.', path: [stepIndex] }))
  if (closedMarkers.size > 200) context.addIssue({ code: 'custom', message: 'A recording cannot contain more than 200 markers.' })
})

type MarkerStartStep = z.infer<typeof markerStartStepSchema>
type MarkerEndStep = z.infer<typeof markerEndStepSchema>
type ScreenshotStep = z.infer<typeof screenshotStepSchema>
type AnnotationStep = z.infer<typeof annotationStepSchema>
type RecordingStep = ActionStep | AnnotationStep
type RecordingSteps = RecordingStep[]
