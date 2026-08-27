import { createRecorderView } from '#vscode-extension/createRecorderView.ts'
import { createRecordingDraftStore } from '#vscode-extension/recording/createRecordingDraftStore.ts'
import { createRecordingEditorProvider, recordingEditorViewType } from '#vscode-extension/recording/createRecordingEditorProvider.ts'
import { commands, window, workspace, type ExtensionContext, type Uri } from 'vscode'

import { parseRecording, RECORDING_DOCUMENT_PATH, type Recording } from '@te/recorder-core'
import { createRecorder } from '@te/recorder-runtime'
import { tryTo } from '@te/recorder-utils'

export { activateExtension }
export type { ActiveExtension }

function activateExtension(args: ActivateExtensionArgs): ActiveExtension {
  const drafts = createRecordingDraftStore({ context: args.context })
  const recorder = createRecorder()
  let recorderState: RecorderState = 'idle'
  const recorderStateReady = updateRecorderContext()
  const disposables = [
    createRecorderView(),
    createRecordingEditorProvider({ context: args.context, drafts, onPlay: playRecording }),
    commands.registerCommand('thousandeyesRecorder.startRecording', startRecording),
    commands.registerCommand('thousandeyesRecorder.stopRecording', stopRecording),
    commands.registerCommand('thousandeyesRecorder.playRecording', playRecording),
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
        await recorder.start({ onStopRequested: stopRecording, startUrl: startUrl.trim() })
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
    await tryTo(
      async () => {
        const artifact = await recorder.stop()
        if (!artifact) return
        await commands.executeCommand('vscode.openWith', await drafts.stage(artifact, getActiveWorkspaceUri()), recordingEditorViewType)
      },
      undefined,
      () => setRecorderState('idle'),
    )
  }

  async function playRecording(recording?: Recording): Promise<void> {
    if (!recording) {
      const editor = window.activeTextEditor
      if (!editor || editor.document.uri.path.split('/').at(-1) !== RECORDING_DOCUMENT_PATH) {
        throw new Error('Open a recording.json file before starting playback.')
      }

      recording = parseRecording(JSON.parse(editor.document.getText()))
    }

    await recorder.play({ recording })
    await window.showInformationMessage(`Played ${recording.actions.length} recorded actions.`)
  }

  function getActiveWorkspaceUri(): Uri | undefined {
    return ((window.activeTextEditor ? workspace.getWorkspaceFolder(window.activeTextEditor.document.uri) : undefined) ?? workspace.workspaceFolders?.[0])?.uri
  }

  async function dispose(): Promise<void> {
    await recorder.dispose()
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
  return tryTo(
    () => {
      new URL(value.trim())
      return undefined
    },
    () => 'Enter a valid absolute URL.',
  )
}

interface ActivateExtensionArgs {
  context: ExtensionContext
}

interface ActiveExtension {
  dispose: () => Promise<void>
}

type RecorderState = 'idle' | 'recording' | 'starting' | 'stopping'
