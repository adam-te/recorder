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
            alt: value => currentScope.getByAltText(value.text, { exact: value.exact }),
            label: value => currentScope.getByLabel(value.text, { exact: value.exact }),
            placeholder: value => currentScope.getByPlaceholder(value.text, { exact: value.exact }),
            role: value => currentScope.getByRole(value.role as AriaRole, { exact: value.exact, name: value.name }),
            text: value => currentScope.getByText(value.text, { exact: value.exact }),
            title: value => currentScope.getByTitle(value.text, { exact: value.exact }),
          }),
        scope,
      ) as Locator,
    css: current => scope.locator(current.value),
    'test-id': current => scope.getByTestId(current.value),
  })
}

type AriaRole = Parameters<Page['getByRole']>[0]
type LocatorScope = FrameLocator | Locator | Page
