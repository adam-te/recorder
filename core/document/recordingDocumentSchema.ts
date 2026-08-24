import type { AriaNode } from '@te/aria'
import { z } from 'zod'

export { recordedActionSchema, recordedAriaSnapshotSchema, recordedLocatorSchema, recordedValueSchema, recordingDocumentSchema }
export type { RecordedAction, RecordedAriaNode, RecordedAriaSnapshot, RecordedLocator, RecordedValue, RecordingDocument }

const recordedLocatorContextSchema = { framePath: z.array(z.string().min(1)).optional() }
const recordedAriaLocatorStepSchema = z.discriminatedUnion('method', [z.object({ exact: z.boolean().optional(), method: z.literal('label'), text: z.string().min(1) }), z.object({ exact: z.boolean().optional(), method: z.literal('role'), name: z.string().min(1).optional(), role: z.string().min(1) })])
const recordedLocatorSchema = z.discriminatedUnion('kind', [z.object({ ...recordedLocatorContextSchema, kind: z.literal('aria'), steps: z.array(recordedAriaLocatorStepSchema).min(1) }), z.object({ ...recordedLocatorContextSchema, kind: z.literal('css'), value: z.string().min(1) })])

const recordedValueSchema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('plain-text'), value: z.string() }), z.object({ kind: z.literal('secret'), name: z.string().min(1) })])

const recordedModifierSchema = z.enum(['Alt', 'Control', 'Meta', 'Shift'])
const recordedPositionSchema = z.object({ x: z.number(), y: z.number() })
const recordedActionContextSchema = { pageUrl: z.url() }
const recordedAriaRoleSchema = z
  .string()
  .min(1)
  .transform(value => value as AriaNode['role'])
const recordedAriaNodeSchema: z.ZodType<RecordedAriaNode> = z.lazy(() =>
  z.object({
    active: z.boolean().optional(),
    checked: z.union([z.boolean(), z.literal('mixed')]).optional(),
    children: z.array(z.union([recordedAriaNodeSchema, z.string()])).optional(),
    cursor: z.literal('pointer').optional(),
    disabled: z.boolean().optional(),
    expanded: z.boolean().optional(),
    invalid: z.union([z.boolean(), z.literal('grammar'), z.literal('spelling')]).optional(),
    level: z.number().optional(),
    name: z.string(),
    pressed: z.union([z.boolean(), z.literal('mixed')]).optional(),
    props: z.record(z.string(), z.string()),
    ref: z.string().min(1).optional(),
    role: recordedAriaRoleSchema,
    selected: z.boolean().optional(),
    target: z.literal(true).optional(),
  }),
)
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

const recordingDocumentSchema = z.object({
  title: z.string().min(1),
  startUrl: z.url(),
  createdAt: z.iso.datetime(),
  actions: z.array(recordedActionSchema),
})

type RecordedAction = z.infer<typeof recordedActionSchema>
type RecordedAriaSnapshot = z.infer<typeof recordedAriaSnapshotSchema>
type RecordedLocator = z.infer<typeof recordedLocatorSchema>
type RecordedValue = z.infer<typeof recordedValueSchema>
type RecordingDocument = z.infer<typeof recordingDocumentSchema>

interface RecordedAriaNode extends Omit<AriaNode, 'children'> {
  children?: (RecordedAriaNode | string)[]
  target?: true
}
