import { ariaRuntimeSource } from '#recorder-runtime/injected/generated/ariaRuntimeSource.generated.ts'
import { recordingOverlaySource } from '#recorder-runtime/injected/generated/recordingOverlaySource.generated.ts'
import { DISPOSE_OVERLAY_FUNCTION_NAME, OVERLAY_CONFIG_NAME, STOP_BINDING_NAME } from '#recorder-runtime/injected/protocol.ts'
import type { BrowserContext, Page } from 'playwright'

import { tryTo } from '@te/recorder-utils'

export { installRecordingOverlay }
export type { RecordingOverlay }

async function installRecordingOverlay(args: InstallRecordingOverlayArgs): Promise<RecordingOverlay> {
  const stopBinding = args.onStopRequested ? await args.context.exposeBinding(STOP_BINDING_NAME, args.onStopRequested) : undefined
  const source = createInjectedOverlaySource(Boolean(stopBinding))
  const initScript = await tryTo(
    () => args.context.addInitScript({ content: source }),
    async error => {
      await stopBinding?.dispose()
      throw error
    },
  )
  await tryTo(
    () => Promise.all(args.page.frames().map(frame => frame.evaluate(source))),
    async error => {
      await initScript.dispose()
      await stopBinding?.dispose()
      throw error
    },
  )

  return { dispose }

  async function dispose(): Promise<void> {
    await Promise.all(args.page.frames().map(frame => frame.evaluate(name => (globalThis as unknown as Record<string, (() => void) | undefined>)[name]?.(), DISPOSE_OVERLAY_FUNCTION_NAME)))
    await Promise.all([initScript.dispose(), stopBinding?.dispose()])
  }
}

function createInjectedOverlaySource(showsControls: boolean): string {
  const configSource = `globalThis[${JSON.stringify(OVERLAY_CONFIG_NAME)}]=${JSON.stringify({ showsControls })}`

  return `${configSource};${ariaRuntimeSource};${recordingOverlaySource}`
}

interface InstallRecordingOverlayArgs {
  context: BrowserContext
  onStopRequested?: () => Promise<void> | void
  page: Page
}

interface RecordingOverlay {
  dispose: () => Promise<void>
}
