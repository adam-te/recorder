import { recordedLocatorContextShape, recordedModifierSchema, recordedPageContextShape, recordedPositionSchema, recordedValueSchema } from '#recording/shared/recordedDataSchema.ts'
import { z } from 'zod'

export { actionStepSchema }
export type { ActionStep }

const actionStepSchema = z.discriminatedUnion('kind', [
  z.object({ ...recordedPageContextShape, kind: z.literal('goto'), url: z.url() }),
  z.object({ ...recordedPageContextShape, kind: z.literal('go-back') }),
  z.object({ ...recordedPageContextShape, kind: z.literal('go-forward') }),
  z.object({ ...recordedPageContextShape, kind: z.literal('reload') }),
  z.object({ ...recordedPageContextShape, ...recordedLocatorContextShape, button: z.enum(['left', 'middle', 'right']).optional(), clickCount: z.number().int().positive().optional(), kind: z.literal('click'), modifiers: z.array(recordedModifierSchema).optional(), position: recordedPositionSchema.optional() }),
  z.object({ ...recordedPageContextShape, ...recordedLocatorContextShape, kind: z.literal('fill'), value: recordedValueSchema }),
  z.object({ ...recordedPageContextShape, ...recordedLocatorContextShape, checked: z.boolean(), kind: z.literal('check') }),
  z.object({ ...recordedPageContextShape, ...recordedLocatorContextShape, key: z.string().min(1), kind: z.literal('press'), modifiers: z.array(recordedModifierSchema).optional() }),
  z.object({ ...recordedPageContextShape, ...recordedLocatorContextShape, kind: z.literal('select'), options: z.array(z.string()) }),
  z.object({ ...recordedPageContextShape, ...recordedLocatorContextShape, kind: z.literal('hover'), position: recordedPositionSchema.optional() }),
  z.object({ ...recordedPageContextShape, ...recordedLocatorContextShape, files: z.array(z.string()), kind: z.literal('set-input-files') }),
  z.object({ ...recordedPageContextShape, ...recordedLocatorContextShape, kind: z.literal('assert-visible') }),
])

type ActionStep = z.infer<typeof actionStepSchema>
