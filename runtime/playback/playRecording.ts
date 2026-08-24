import type { BrowserSession } from '#recorder-runtime/browser/createBrowserSession.ts'
import type { FrameLocator, Locator, Page } from 'playwright'

import type { PlaybackObserver, PlaybackResult, RecordedAction, RecordedLocator, RecordedValue, RecordingDocument } from '@te/recorder-core'
import { matchBy } from '@te/recorder-utils'

export { playRecording }
export type { PlayRecordingArgs }

async function playRecording(args: PlayRecordingArgs): Promise<PlaybackResult> {
  for (const [index, action] of args.document.actions.entries()) {
    await args.observer?.onActionStarted?.({ action, index })
    await executeAction({ action, page: args.session.page, resolveSecret: args.resolveSecret })
    await args.observer?.onActionCompleted?.({ action, index })
  }

  return { completedActions: args.document.actions.length }
}

async function executeAction(args: ExecuteActionArgs): Promise<void> {
  await matchBy(args.action, 'kind', {
    'assert-visible': action => resolveLocator(args.page, action.locatorCandidates[0]).waitFor({ state: 'visible' }),
    check: action => resolveLocator(args.page, action.locatorCandidates[0])[action.checked ? 'check' : 'uncheck'](),
    click: action => resolveLocator(args.page, action.locatorCandidates[0]).click({ button: action.button, clickCount: action.clickCount, modifiers: action.modifiers, position: action.position }),
    fill: async action => resolveLocator(args.page, action.locatorCandidates[0]).fill(await resolveValue(action.value, args.resolveSecret)),
    'go-back': () => args.page.goBack().then(() => undefined),
    'go-forward': () => args.page.goForward().then(() => undefined),
    goto: action => args.page.goto(action.url).then(() => undefined),
    hover: action => resolveLocator(args.page, action.locatorCandidates[0]).hover({ position: action.position }),
    press: action => resolveLocator(args.page, action.locatorCandidates[0]).press([...(action.modifiers ?? []), action.key].join('+')),
    reload: () => args.page.reload().then(() => undefined),
    select: action => resolveLocator(args.page, action.locatorCandidates[0]).selectOption(action.options),
    'set-input-files': action => resolveLocator(args.page, action.locatorCandidates[0]).setInputFiles(action.files),
  })
}

function resolveLocator(page: Page, locator: RecordedLocator): Locator {
  const scope = (locator.framePath ?? []).reduce<Page | FrameLocator>((currentScope, frameSelector) => currentScope.locator(frameSelector).contentFrame(), page)

  return matchBy(locator, 'kind', {
    aria: current =>
      current.steps.reduce<LocatorScope>(
        (currentScope, step) =>
          matchBy(step, 'method', {
            label: value => currentScope.getByLabel(value.text, { exact: value.exact }),
            role: value => currentScope.getByRole(value.role as AriaRole, { exact: value.exact, name: value.name }),
          }),
        scope,
      ) as Locator,
    css: current => scope.locator(current.value),
  })
}

async function resolveValue(value: RecordedValue, resolveSecret: ResolveSecret | undefined): Promise<string> {
  return matchBy(value, 'kind', {
    'plain-text': current => current.value,
    secret: current => {
      if (!resolveSecret) {
        throw new Error(`Playback requires a value for secret ${current.name}.`)
      }

      return resolveSecret(current.name)
    },
  })
}

interface ExecuteActionArgs {
  action: RecordedAction
  page: Page
  resolveSecret?: ResolveSecret
}

interface PlayRecordingArgs {
  document: RecordingDocument
  observer?: PlaybackObserver
  resolveSecret?: ResolveSecret
  session: BrowserSession
}

type ResolveSecret = (name: string) => Promise<string> | string
type AriaRole = Parameters<Page['getByRole']>[0]
type LocatorScope = FrameLocator | Locator | Page
