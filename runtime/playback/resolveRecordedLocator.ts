import type { FrameLocator, Locator, Page } from 'playwright'

import type { RecordedLocator } from '@te/recorder-core'
import { matchBy } from '@te/recorder-utils'

export { resolveRecordedLocator }

function resolveRecordedLocator(page: Page, locator: RecordedLocator): Locator {
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

type AriaRole = Parameters<Page['getByRole']>[0]
type LocatorScope = FrameLocator | Locator | Page
