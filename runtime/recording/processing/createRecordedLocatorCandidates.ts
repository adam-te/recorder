import { SELECTOR_GENERATOR_NAME } from '#recorder-runtime/recording/injected/generateSelectorCandidates.ts'
import type { CapturedCssSelector } from '#recorder-runtime/recording/injected/types.ts'
import type { CapturedInteraction } from '#recorder-runtime/recording/installRecordingCapture/index.ts'
import type { Frame } from 'playwright'

import type { RecordedLocator } from '@te/recorder-core'

export { createRecordedLocatorCandidates }

async function createRecordedLocatorCandidates(interaction: CapturedInteraction): Promise<RecordedLocator[]> {
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

  if (!interaction.selectors.length) {
    throw new Error('Recorder did not capture a selector for the interaction.')
  }

  return interaction.selectors.map(locator => ({ ...locator, ...(framePath.length ? { framePath } : {}) })).slice(0, maxCandidates)

  async function getFrameSelector(currentFrame: Frame): Promise<CapturedCssSelector> {
    const selectors = await (await currentFrame.frameElement()).evaluate((element, selectorGeneratorName) => (globalThis as unknown as Record<string, (value: Element) => CapturedCssSelector[]>)[selectorGeneratorName](element as Element), SELECTOR_GENERATOR_NAME)

    if (!selectors[0]) {
      throw new Error('Recorder did not capture a selector for an interaction frame.')
    }

    return selectors[0]
  }
}
