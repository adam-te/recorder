import { resolveRecordedLocator } from '#execution/resolveRecordedLocator.ts'
import type { Page } from 'playwright'

import type { ActionStep, RecordedValue } from '@te/recorder-recording'
import { matchBy } from '@te/recorder-utils'

export { executeActionStep }

async function executeActionStep(args: ExecuteActionStepArgs): Promise<void> {
  await matchBy(args.step, 'kind', {
    'assert-visible': step => resolveRecordedLocator(args.page, step.locatorCandidates[0]).waitFor({ state: 'visible' }),
    check: step => resolveRecordedLocator(args.page, step.locatorCandidates[0])[step.checked ? 'check' : 'uncheck'](),
    click: step => resolveRecordedLocator(args.page, step.locatorCandidates[0]).click({ button: step.button, clickCount: step.clickCount, modifiers: step.modifiers, position: step.position }),
    fill: async step => resolveRecordedLocator(args.page, step.locatorCandidates[0]).fill(await resolveRecordedValue(step.value, args.resolveSecret)),
    'go-back': () => args.page.goBack().then(() => undefined),
    'go-forward': () => args.page.goForward().then(() => undefined),
    goto: step => args.page.goto(step.url).then(() => undefined),
    hover: step => resolveRecordedLocator(args.page, step.locatorCandidates[0]).hover({ position: step.position }),
    press: step => resolveRecordedLocator(args.page, step.locatorCandidates[0]).press([...(step.modifiers ?? []), step.key].join('+')),
    reload: () => args.page.reload().then(() => undefined),
    select: step => resolveRecordedLocator(args.page, step.locatorCandidates[0]).selectOption(step.options),
    'set-input-files': step => resolveRecordedLocator(args.page, step.locatorCandidates[0]).setInputFiles(step.files),
  })
}

async function resolveRecordedValue(value: RecordedValue, resolveSecret: ResolveSecret | undefined): Promise<string> {
  return matchBy(value, 'kind', {
    'plain-text': current => current.value,
    secret: current => {
      if (!resolveSecret) throw new Error(`Execution requires a value for secret ${current.name}.`)

      return resolveSecret(current.name)
    },
  })
}

interface ExecuteActionStepArgs {
  page: Page
  resolveSecret?: ResolveSecret
  step: ActionStep
}

type ResolveSecret = (name: string) => Promise<string> | string
