import { z } from 'zod'

export { recordedAriaSnapshotSchema, recordedLocatorContextShape, recordedLocatorSchema, recordedModifierSchema, recordedPageContextShape, recordedPositionSchema, recordedValueSchema }
export type { RecordedAriaNode, RecordedAriaSnapshot, RecordedLocator, RecordedValue }

const recordedPageContextShape = { pageUrl: z.url() }
const recordedModifierSchema = z.enum(['Alt', 'Control', 'Meta', 'Shift'])
const recordedPositionSchema = z.object({ x: z.number(), y: z.number() })
const recordedValueSchema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('plain-text'), value: z.string() }), z.object({ kind: z.literal('secret'), name: z.string().min(1) })])

const recordedLocatorFrameContextShape = { framePath: z.array(z.string().min(1)).optional() }
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
  z.object({ ...recordedLocatorFrameContextShape, kind: z.literal('aria'), steps: z.array(recordedAriaLocatorStepSchema).min(1) }),
  z.object({ ...recordedLocatorFrameContextShape, kind: z.literal('css'), value: z.string().min(1) }),
  z.object({ ...recordedLocatorFrameContextShape, kind: z.literal('test-id'), value: z.string().min(1) }),
])
const recordedLocatorContextShape = { locatorCandidates: z.tuple([recordedLocatorSchema], recordedLocatorSchema) }

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

  if (targetCount > 1) context.addIssue({ code: 'custom', message: 'An ARIA snapshot cannot contain more than one target.' })

  function visit(node: RecordedAriaNode): void {
    targetCount += node.target ? 1 : 0
    node.children?.forEach(child => typeof child !== 'string' && visit(child))
  }
})

type RecordedAriaNode = z.infer<typeof recordedAriaNodeSchema>
type RecordedAriaSnapshot = z.infer<typeof recordedAriaSnapshotSchema>
type RecordedLocator = z.infer<typeof recordedLocatorSchema>
type RecordedValue = z.infer<typeof recordedValueSchema>
