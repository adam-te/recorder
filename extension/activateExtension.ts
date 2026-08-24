import { createRecorderView } from '#recorder-extension/createRecorderView.ts'
import { createRecorderController } from '#recorder-extension/recording/createRecorderController.ts'
import { commands, ProgressLocation, window, type ExtensionContext } from 'vscode'

import { tryTo } from '@te/recorder-utils'

export { activateExtension }
export type { ActiveExtension }

function activateExtension(args: ActivateExtensionArgs): ActiveExtension {
  const controller = createRecorderController({ context: args.context, onStopRequested: stopRecording })
  let recorderState: RecorderState = 'idle'
  const recorderStateReady = updateRecorderContext()
  const disposables = [createRecorderView(), commands.registerCommand('thousandeyesRecorder.startRecording', startRecording), commands.registerCommand('thousandeyesRecorder.stopRecording', stopRecording), commands.registerCommand('thousandeyesRecorder.playRecording', controller.play)]

  args.context.subscriptions.push(...disposables)

  return { dispose }

  async function startRecording(): Promise<void> {
    if (recorderState !== 'idle') {
      return
    }

    recorderState = 'starting'
    await recorderStateReady
    await updateRecorderContext()
    await tryTo(
      () =>
        window.withProgress({ location: ProgressLocation.Notification, title: 'Opening recorder browser…' }, async () => {
          await controller.start()
          await setRecorderState('recording')
        }),
      async error => {
        await setRecorderState('idle')
        throw error
      },
    )
  }

  async function stopRecording(): Promise<void> {
    if (recorderState !== 'recording') {
      return
    }

    await setRecorderState('stopping')
    await tryTo(
      () => window.withProgress({ location: ProgressLocation.Notification, title: 'Stopping recording…' }, controller.stop),
      undefined,
      () => setRecorderState('idle'),
    )
  }

  async function dispose(): Promise<void> {
    await controller.dispose()
    disposables.forEach(disposable => disposable.dispose())
  }

  async function setRecorderState(state: RecorderState): Promise<void> {
    recorderState = state
    await updateRecorderContext()
  }

  async function updateRecorderContext(): Promise<void> {
    await commands.executeCommand('setContext', 'thousandeyesRecorder.state', recorderState)
  }
}

interface ActivateExtensionArgs {
  context: ExtensionContext
}

interface ActiveExtension {
  dispose: () => Promise<void>
}

type RecorderState = 'idle' | 'recording' | 'starting' | 'stopping'
