import { recordedLocatorContextShape, recordedModifierSchema, recordedPageContextShape } from '#recording/shared/recordedDataSchema.ts'
import { z } from 'zod'

export { rawEventSchema, recordingSchema }
export type { RawEvent, Recording, RecordingMetadata }

const rawEventSchema = z.discriminatedUnion('kind', [
  z.object({ ...recordedPageContextShape, kind: z.literal('goto'), url: z.url() }),
  z.object({ ...recordedPageContextShape, ...recordedLocatorContextShape, kind: z.literal('click') }),
  z.object({ ...recordedPageContextShape, ...recordedLocatorContextShape, inputValue: z.string().optional(), key: z.string().min(1), kind: z.literal('key-press'), modifiers: z.array(recordedModifierSchema).optional() }),
])

const recordingSchema = z.object({
  title: z.string().min(1),
  startUrl: z.url(),
  createdAt: z.iso.datetime(),
  events: z.array(rawEventSchema),
})

type RawEvent = Readonly<z.infer<typeof rawEventSchema>>
type ParsedRecording = z.infer<typeof recordingSchema>
type Recording = Readonly<Omit<ParsedRecording, 'events'> & { events: readonly RawEvent[] }>
type RecordingMetadata = Omit<Recording, 'events'>
