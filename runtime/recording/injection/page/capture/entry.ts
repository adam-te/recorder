import { recordPageInteractions } from '#runtime/recording/injection/page/capture/recordPageInteractions.ts'
import { INTERACTION_BINDING_NAME, RECORDER_UI_ATTRIBUTE, SELECTOR_GENERATOR_NAME } from '#runtime/recording/injection/protocol.ts'
import * as ariaRuntime from '@te/aria/browser'

recordPageInteractions(
  {
    bindingName: INTERACTION_BINDING_NAME,
    recorderUiAttribute: RECORDER_UI_ATTRIBUTE,
    selectorGeneratorName: SELECTOR_GENERATOR_NAME,
  },
  ariaRuntime,
)
