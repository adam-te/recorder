import { recordPageInteractions } from '#runtime/injected/capture/recordPageInteractions.ts'
import { INTERACTION_BINDING_NAME, RECORDER_UI_ATTRIBUTE, SELECTOR_GENERATOR_NAME } from '#runtime/injected/protocol.ts'
import * as ariaRuntime from '@te/aria/browser'

recordPageInteractions(
  {
    bindingName: INTERACTION_BINDING_NAME,
    recorderUiAttribute: RECORDER_UI_ATTRIBUTE,
    selectorGeneratorName: SELECTOR_GENERATOR_NAME,
  },
  ariaRuntime,
)
