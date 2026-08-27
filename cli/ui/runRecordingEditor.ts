import { chromium } from 'playwright'

import { serializeRecording, type Recording } from '@te/recorder-core'
import { createRecordingEditorPresenter, renderRecordingSnapshot } from '@te/recorder-ui/recording-editor/host'
import { matchBy, tryTo } from '@te/recorder-utils'

import { createFileRecordingArtifactStore } from '../recording/createFileRecordingArtifactStore.ts'
import { createRecordingEditorServer } from './createRecordingEditorServer.ts'

export { runRecordingEditor }
export type { RunRecordingEditorArgs }

async function runRecordingEditor(args: RunRecordingEditorArgs): Promise<void> {
  const store = createFileRecordingArtifactStore(args.directoryPath)
  await store.load()

  const presenter = createRecordingEditorPresenter({
    isPending: () => false,
    readRecording: store.load,
    readSnapshot: async actionIndex => renderRecordingSnapshot(await store.loadSnapshot(actionIndex)),
  })
  const server = await createRecordingEditorServer({
    handleMessage: message =>
      matchBy(message, 'type', {
        play: async () =>
          await tryTo(
            async () => {
              await args.onPlay(await store.load())
              return {}
            },
            error => ({ error: getErrorMessage(error) }),
          ),
        ready: async () => ({ messages: await presenter.ready() }),
        selectAction: async current => ({ messages: await presenter.selectAction(current.actionIndex) }),
      }),
    loadRecordingDocument: async () => serializeRecording(await store.load()),
  })

  await tryTo(
    async () => {
      await args.stdout.write(`Recording editor opened at ${server.url}\nClose its browser window to stop the server.\n`)
      await (args.openBrowser ?? openBrowser)(server.url)
    },
    undefined,
    server.close,
  )
}

async function openBrowser(url: string): Promise<void> {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage({ colorScheme: null })

  await tryTo(
    async () => {
      await page.goto(url)
      await new Promise<void>(resolve => page.once('close', () => resolve()))
    },
    undefined,
    () => browser.close(),
  )
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface RunRecordingEditorArgs {
  directoryPath: string
  onPlay: (recording: Recording) => Promise<void>
  openBrowser?: (url: string) => Promise<void>
  stdout: { write: (value: string) => Promise<unknown> | unknown }
}
