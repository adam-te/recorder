import { z } from 'zod'

export { recordedActionSchema, recordedAriaSnapshotSchema, recordedLocatorSchema, recordedValueSchema, recordingSchema }
export type { RecordedAction, RecordedAriaNode, RecordedAriaSnapshot, RecordedLocator, RecordedMarker, RecordedScreenshot, RecordedValue, Recording }

const recordedLocatorContextSchema = { framePath: z.array(z.string().min(1)).optional() }
const recordedTextLocatorStepSchema = <Method extends 'alt' | 'label' | 'placeholder' | 'text' | 'title'>(method: Method) => z.object({ exact: z.boolean().optional(), method: z.literal(method), text: z.string().min(1) })
const recordedAriaLocatorStepSchema = z.discriminatedUnion('method', [
  recordedTextLocatorStepSchema('alt'),
  recordedTextLocatorStepSchema('label'),
  recordedTextLocatorStepSchema('placeholder'),
  recordedTextLocatorStepSchema('text'),
  recordedTextLocatorStepSchema('title'),
  z.object({ exact: z.boolean().optional(), method: z.literal('role'), name: z.string().min(1).optional(), role: z.string().min(1) }),
])
const recordedLocatorSchema = z.discriminatedUnion('kind', [
  z.object({ ...recordedLocatorContextSchema, kind: z.literal('aria'), steps: z.array(recordedAriaLocatorStepSchema).min(1) }),
  z.object({ ...recordedLocatorContextSchema, kind: z.literal('css'), value: z.string().min(1) }),
  z.object({ ...recordedLocatorContextSchema, kind: z.literal('test-id'), value: z.string().min(1) }),
])

const recordedValueSchema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('plain-text'), value: z.string() }), z.object({ kind: z.literal('secret'), name: z.string().min(1) })])

const recordedModifierSchema = z.enum(['Alt', 'Control', 'Meta', 'Shift'])
const recordedPositionSchema = z.object({ x: z.number(), y: z.number() })
const recordedActionContextSchema = { pageUrl: z.url() }
const recordedAriaNodeSchema = z.object({
  active: z.boolean().optional(),
  checked: z.union([z.boolean(), z.literal('mixed')]).optional(),
  get children() {
    return z.array(z.union([recordedAriaNodeSchema, z.string()])).optional()
  },
  cursor: z.literal('pointer').optional(),
  disabled: z.boolean().optional(),
  expanded: z.boolean().optional(),
  invalid: z.union([z.boolean(), z.literal('grammar'), z.literal('spelling')]).optional(),
  level: z.number().optional(),
  name: z.string(),
  pressed: z.union([z.boolean(), z.literal('mixed')]).optional(),
  props: z.record(z.string(), z.string()),
  ref: z.string().min(1).optional(),
  role: z.string().min(1),
  selected: z.boolean().optional(),
  target: z.literal(true).optional(),
})
const recordedAriaSnapshotSchema = recordedAriaNodeSchema.superRefine((snapshot, context) => {
  let targetCount = 0
  visit(snapshot)

  if (targetCount > 1) {
    context.addIssue({ code: 'custom', message: 'An ARIA snapshot cannot contain more than one target.' })
  }

  function visit(node: RecordedAriaNode): void {
    targetCount += node.target ? 1 : 0
    node.children?.forEach(child => typeof child !== 'string' && visit(child))
  }
})
const recordedActionLocatorContextSchema = { locatorCandidates: z.tuple([recordedLocatorSchema], recordedLocatorSchema) }

const recordedActionSchema = z.discriminatedUnion('kind', [
  z.object({ ...recordedActionContextSchema, kind: z.literal('goto'), url: z.url() }),
  z.object({ ...recordedActionContextSchema, kind: z.literal('go-back') }),
  z.object({ ...recordedActionContextSchema, kind: z.literal('go-forward') }),
  z.object({ ...recordedActionContextSchema, kind: z.literal('reload') }),
  z.object({ ...recordedActionContextSchema, ...recordedActionLocatorContextSchema, button: z.enum(['left', 'middle', 'right']).optional(), clickCount: z.number().int().positive().optional(), kind: z.literal('click'), modifiers: z.array(recordedModifierSchema).optional(), position: recordedPositionSchema.optional() }),
  z.object({ ...recordedActionContextSchema, ...recordedActionLocatorContextSchema, kind: z.literal('fill'), value: recordedValueSchema }),
  z.object({ ...recordedActionContextSchema, ...recordedActionLocatorContextSchema, checked: z.boolean(), kind: z.literal('check') }),
  z.object({ ...recordedActionContextSchema, ...recordedActionLocatorContextSchema, key: z.string().min(1), kind: z.literal('press'), modifiers: z.array(recordedModifierSchema).optional() }),
  z.object({ ...recordedActionContextSchema, ...recordedActionLocatorContextSchema, kind: z.literal('select'), options: z.array(z.string()) }),
  z.object({ ...recordedActionContextSchema, ...recordedActionLocatorContextSchema, kind: z.literal('hover'), position: recordedPositionSchema.optional() }),
  z.object({ ...recordedActionContextSchema, ...recordedActionLocatorContextSchema, files: z.array(z.string()), kind: z.literal('set-input-files') }),
  z.object({ ...recordedActionContextSchema, ...recordedActionLocatorContextSchema, kind: z.literal('assert-visible') }),
])

const recordedMarkerSchema = z.object({ end: z.number().int().positive(), name: z.string().min(1), start: z.number().int().nonnegative() })
const recordedScreenshotSchema = z.object({ at: z.number().int().nonnegative() })

const recordingSchema = z
  .object({
    title: z.string().min(1),
    startUrl: z.url(),
    createdAt: z.iso.datetime(),
    actions: z.array(recordedActionSchema),
    thousandEyes: z.object({ markers: z.array(recordedMarkerSchema).max(200), screenshots: z.array(recordedScreenshotSchema) }),
  })
  .superRefine((recording, context) => {
    const markerNames = new Set<string>()
    const screenshotPositions = new Set<number>()

    recording.thousandEyes.markers.forEach((marker, markerIndex) => {
      if (marker.start >= marker.end) context.addIssue({ code: 'custom', message: 'Marker start must be before marker end.', path: ['thousandEyes', 'markers', markerIndex] })
      if (marker.end > recording.actions.length) context.addIssue({ code: 'custom', message: 'Marker positions must be within the action boundaries.', path: ['thousandEyes', 'markers', markerIndex] })
      if (markerNames.has(marker.name)) context.addIssue({ code: 'custom', message: 'Marker names must be unique.', path: ['thousandEyes', 'markers', markerIndex, 'name'] })

      markerNames.add(marker.name)
    })

    recording.thousandEyes.screenshots.forEach((screenshot, screenshotIndex) => {
      if (screenshot.at > recording.actions.length) context.addIssue({ code: 'custom', message: 'Screenshot positions must be within the action boundaries.', path: ['thousandEyes', 'screenshots', screenshotIndex, 'at'] })
      if (screenshotPositions.has(screenshot.at)) context.addIssue({ code: 'custom', message: 'Only one screenshot can be taken at an action boundary.', path: ['thousandEyes', 'screenshots', screenshotIndex, 'at'] })

      screenshotPositions.add(screenshot.at)
    })
  })

type RecordedAction = z.infer<typeof recordedActionSchema>
type RecordedAriaNode = z.infer<typeof recordedAriaNodeSchema>
type RecordedAriaSnapshot = z.infer<typeof recordedAriaSnapshotSchema>
type RecordedLocator = z.infer<typeof recordedLocatorSchema>
type RecordedMarker = z.infer<typeof recordedMarkerSchema>
type RecordedScreenshot = z.infer<typeof recordedScreenshotSchema>
type RecordedValue = z.infer<typeof recordedValueSchema>
type Recording = z.infer<typeof recordingSchema>
