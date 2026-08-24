import { resolveRecordedLocator } from '#runtime/playback/resolveRecordedLocator.ts'
import type { Page } from 'playwright'

import type { RecordedAction, RecordedValue } from '@te/recorder-core'
import { matchBy } from '@te/recorder-utils'

export { executeRecordedAction }

async function executeRecordedAction(args: ExecuteRecordedActionArgs): Promise<void> {
  await matchBy(args.action, 'kind', {
    'assert-visible': action => resolveRecordedLocator(args.page, action.locatorCandidates[0]).waitFor({ state: 'visible' }),
    check: action => resolveRecordedLocator(args.page, action.locatorCandidates[0])[action.checked ? 'check' : 'uncheck'](),
    click: action => resolveRecordedLocator(args.page, action.locatorCandidates[0]).click({ button: action.button, clickCount: action.clickCount, modifiers: action.modifiers, position: action.position }),
    fill: async action => resolveRecordedLocator(args.page, action.locatorCandidates[0]).fill(await resolveRecordedValue(action.value, args.resolveSecret)),
    'go-back': () => args.page.goBack().then(() => undefined),
    'go-forward': () => args.page.goForward().then(() => undefined),
    goto: action => args.page.goto(action.url).then(() => undefined),
    hover: action => resolveRecordedLocator(args.page, action.locatorCandidates[0]).hover({ position: action.position }),
    press: action => resolveRecordedLocator(args.page, action.locatorCandidates[0]).press([...(action.modifiers ?? []), action.key].join('+')),
    reload: () => args.page.reload().then(() => undefined),
    select: action => resolveRecordedLocator(args.page, action.locatorCandidates[0]).selectOption(action.options),
    'set-input-files': action => resolveRecordedLocator(args.page, action.locatorCandidates[0]).setInputFiles(action.files),
  })
}

async function resolveRecordedValue(value: RecordedValue, resolveSecret: ResolveSecret | undefined): Promise<string> {
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

interface ExecuteRecordedActionArgs {
  action: RecordedAction
  page: Page
  resolveSecret?: ResolveSecret
}

type ResolveSecret = (name: string) => Promise<string> | string
