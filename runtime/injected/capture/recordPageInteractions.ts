import { generateLocatorCandidates } from '#runtime/injected/locators/generateLocatorCandidates.ts'
import { generateSelectorCandidates } from '#runtime/injected/locators/generateSelectorCandidates.ts'
import type { CapturedCssSelector, CapturedInteractionEvent, SerializedInteraction } from '#runtime/injected/protocol.ts'
import type { AriaRuntime } from '@te/aria/browser'

export { recordPageInteractions }

function recordPageInteractions(args: RecordPageInteractionsArgs, ariaRuntime: AriaRuntime): void {
  const reportInteraction = (globalThis as unknown as Record<string, (value: SerializedInteraction) => Promise<void>>)[args.bindingName]
  const capturedEvents = new WeakSet<Event>()
  const eventSerializers: EventSerializers = {
    change: () => ({ kind: 'change' }),
    click: () => ({ kind: 'click' }),
    input: event => ({ inputType: event.inputType, kind: 'input' }),
    keydown: event => ({ code: event.code, key: event.key, kind: 'keydown', repeat: event.repeat }),
  }
  const attachShadow = Element.prototype.attachShadow
  const closedShadowRoots = new WeakMap<Element, ShadowRoot>()

  ;(globalThis as unknown as Record<string, (element: Element) => CapturedCssSelector[]>)[args.selectorGeneratorName] = generateSelectorCandidates

  Element.prototype.attachShadow = function recorderAttachShadow(init: ShadowRootInit): ShadowRoot {
    const shadowRoot = attachShadow.call(this, init)

    closedShadowRoots.set(this, shadowRoot)
    installListeners(shadowRoot)
    return shadowRoot
  }

  installListeners(window)

  function installListeners(target: Window | ShadowRoot): void {
    Object.entries(eventSerializers).forEach(([eventName, serialize]) => target.addEventListener(eventName, event => captureEvent(event, serialize), { capture: true }))
  }

  function captureEvent(event: Event, serialize: (event: never) => CapturedInteractionEvent): void {
    const targetPath = event.composedPath().filter((candidate): candidate is Element => candidate instanceof Element)
    const target = targetPath[0]
    const isRecorderUiEvent = targetPath.some(candidate => candidate.hasAttribute(args.recorderUiAttribute))

    if (target && !isRecorderUiEvent && !capturedEvents.has(event)) {
      capturedEvents.add(event)
      const snapshotOptions = { target, targetPath }
      const locatorOptions = {
        excludeElement: (element: Element) => element.hasAttribute(args.recorderUiAttribute) || Boolean(element.closest(`[${args.recorderUiAttribute}]`)),
        getShadowRoot: (element: Element) => element.shadowRoot ?? closedShadowRoots.get(element) ?? null,
        target,
      }
      const { snapshot: ariaSnapshot, targetRef } = ariaRuntime.generateAriaSnapshot(snapshotOptions)
      const selectors = generateLocatorCandidates(target, generateSelectorCandidates, ariaRuntime, locatorOptions)

      void reportInteraction({ ariaSnapshot, event: serialize(event as never), selectors, ...(targetRef ? { targetRef } : {}) })
    }
  }
}

interface EventSerializers {
  change: (event: Event) => Extract<CapturedInteractionEvent, { kind: 'change' }>
  click: (event: MouseEvent) => Extract<CapturedInteractionEvent, { kind: 'click' }>
  input: (event: InputEvent) => Extract<CapturedInteractionEvent, { kind: 'input' }>
  keydown: (event: KeyboardEvent) => Extract<CapturedInteractionEvent, { kind: 'keydown' }>
}

interface RecordPageInteractionsArgs {
  bindingName: string
  recorderUiAttribute: string
  selectorGeneratorName: string
}
