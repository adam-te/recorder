import { createFileRecordingArtifactStore } from '#cli/recording/createFileRecordingArtifactStore.ts'
import { chromium } from 'playwright'

import { getRecordingScreenshotFileName, serializeRecordingSteps, type RecordingSteps } from '@te/recorder-recording'
import { createRecordingEditorPresenter } from '@te/recorder-ui/recording-editor/host'
import { matchBy, tryTo } from '@te/recorder-utils'

import { createRecordingEditorServer } from './createRecordingEditorServer.ts'

export { runRecordingEditor }
export type { RunRecordingEditorArgs }

async function runRecordingEditor(args: RunRecordingEditorArgs): Promise<void> {
  const store = createFileRecordingArtifactStore(args.directoryPath)
  await Promise.all([store.loadRecording(), store.loadSteps()])

  const presenter = createRecordingEditorPresenter({
    isPending: () => false,
    readRecording: store.loadRecording,
    readSteps: store.loadSteps,
    readSnapshot: store.loadSnapshot,
    resolveScreenshotUrl: actionIndex => `./snapshots/${getRecordingScreenshotFileName(actionIndex)}`,
  })
  const server = await createRecordingEditorServer({
    handleMessage: message =>
      matchBy(message, 'type', {
        play: async () =>
          await tryTo(
            async () => {
              await args.onPlay(await store.loadSteps())
              return {}
            },
            error => ({ error: getErrorMessage(error) }),
          ),
        ready: async () => ({ messages: await presenter.ready() }),
        selectAction: async current => ({ messages: await presenter.selectAction(current.actionIndex) }),
        updateStepAnnotations: async current => {
          await store.saveStepAnnotations(current.steps)
          return { messages: await presenter.publishRecording() }
        },
      }),
    loadStepsDocument: async () => serializeRecordingSteps(await store.loadSteps()),
    loadScreenshot: store.loadScreenshot,
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
  onPlay: (steps: RecordingSteps) => Promise<void>
  openBrowser?: (url: string) => Promise<void>
  stdout: { write: (value: string) => Promise<unknown> | unknown }
}
