import { SELECTOR_GENERATOR_NAME } from '#runtime/injected/protocol.ts'
import type { CapturedCssSelector } from '#runtime/injected/protocol.ts'
import type { CapturedInteraction } from '#runtime/recording/capture/types.ts'
import type { Frame } from 'playwright'

import type { RecordedLocator } from '@te/recorder-core'

export { createRecordedLocatorCandidates }

async function createRecordedLocatorCandidates(interaction: CapturedInteraction): Promise<[RecordedLocator, ...RecordedLocator[]]> {
  const maxCandidates = 3
  let framePath: string[] = []
  let frame = interaction.frame
  let parentFrame = frame.parentFrame()

  while (parentFrame) {
    const frameSelector = await getFrameSelector(frame)

    framePath = [frameSelector.value, ...framePath]
    frame = parentFrame
    parentFrame = frame.parentFrame()
  }

  const [firstSelector, ...remainingSelectors] = interaction.selectors

  if (!firstSelector) {
    throw new Error('Recorder did not capture a selector for the interaction.')
  }

  const withFramePath = (locator: RecordedLocator): RecordedLocator => ({ ...locator, ...(framePath.length ? { framePath } : {}) })

  return [withFramePath(firstSelector), ...remainingSelectors.slice(0, maxCandidates - 1).map(withFramePath)]

  async function getFrameSelector(currentFrame: Frame): Promise<CapturedCssSelector> {
    const selectors = await (await currentFrame.frameElement()).evaluate((element, selectorGeneratorName) => (globalThis as unknown as Record<string, (value: Element) => CapturedCssSelector[]>)[selectorGeneratorName](element as Element), SELECTOR_GENERATOR_NAME)

    if (!selectors[0]) {
      throw new Error('Recorder did not capture a selector for an interaction frame.')
    }

    return selectors[0]
  }
}
