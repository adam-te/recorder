import { createRecorderView } from '#vscode-extension/createRecorderView.ts'
import { createRecorderController } from '#vscode-extension/recording/createRecorderController.ts'
import { createRecordingEditorProvider } from '#vscode-extension/recording/createRecordingEditorProvider.ts'
import { commands, window, type ExtensionContext } from 'vscode'

import { tryTo } from '@te/recorder-utils'

export { activateExtension }
export type { ActiveExtension }

function activateExtension(args: ActivateExtensionArgs): ActiveExtension {
  const controller = createRecorderController({ context: args.context, onStopRequested: stopRecording })
  let recorderState: RecorderState = 'idle'
  const recorderStateReady = updateRecorderContext()
  const disposables = [
    createRecorderView(),
    createRecordingEditorProvider({ context: args.context, isPending: controller.isPending, onDiscard: controller.discardPending, onPlay: controller.play, onSave: controller.savePending }),
    commands.registerCommand('thousandeyesRecorder.startRecording', startRecording),
    commands.registerCommand('thousandeyesRecorder.stopRecording', stopRecording),
    commands.registerCommand('thousandeyesRecorder.playRecording', controller.play),
  ]

  args.context.subscriptions.push(...disposables)

  return { dispose }

  async function startRecording(): Promise<void> {
    if (recorderState !== 'idle') {
      return
    }

    recorderState = 'starting'
    await recorderStateReady
    await updateRecorderContext()
    const startUrl = await window.showInputBox({
      ignoreFocusOut: true,
      placeHolder: 'https://example.com',
      prompt: 'Enter the initial URL for the transaction recording.',
      validateInput: validateStartUrl,
    })
    if (!startUrl) {
      await setRecorderState('idle')
      return
    }

    await tryTo(
      async () => {
        await controller.start(startUrl.trim())
        await setRecorderState('recording')
      },
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
    await tryTo(controller.stop, undefined, () => setRecorderState('idle'))
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

function validateStartUrl(value: string): string | undefined {
  try {
    new URL(value.trim())
    return undefined
  } catch {
    return 'Enter a valid absolute URL.'
  }
}

interface ActivateExtensionArgs {
  context: ExtensionContext
}

interface ActiveExtension {
  dispose: () => Promise<void>
}

type RecorderState = 'idle' | 'recording' | 'starting' | 'stopping'
