import { generateLocatorCandidates } from '#capture/injected/locators/generateLocatorCandidates.ts'
import { generateSelectorCandidates } from '#capture/injected/locators/generateSelectorCandidates.ts'
import type { CapturedCssSelector, CapturedInteractionEvent, SerializedInteraction } from '#capture/protocol.ts'
import type { AriaRuntime } from '@te/aria/browser'

export { recordPageInteractions }

function recordPageInteractions(args: RecordPageInteractionsArgs, ariaRuntime: AriaRuntime): void {
  const reportInteraction = (globalThis as unknown as Record<string, (value: SerializedInteraction) => Promise<void>>)[args.bindingName]
  const capturedEvents = new WeakSet<Event>()
  const deferredKeys = new Set(['Backspace', 'Dead', 'Delete', 'Process', 'Unidentified'])
  const textInputTypes = new Set(['email', 'number', 'password', 'search', 'tel', 'text', 'url'])
  const attachShadow = Element.prototype.attachShadow
  const closedShadowRoots = new WeakMap<Element, ShadowRoot>()
  let pendingEditableKeydown: { interaction: SerializedInteraction; target: Element } | undefined

  ;(globalThis as unknown as Record<string, (element: Element) => CapturedCssSelector[]>)[args.selectorGeneratorName] = generateSelectorCandidates

  Element.prototype.attachShadow = function recorderAttachShadow(init: ShadowRootInit): ShadowRoot {
    const shadowRoot = attachShadow.call(this, init)

    closedShadowRoots.set(this, shadowRoot)
    installListeners(shadowRoot)
    return shadowRoot
  }

  installListeners(window)

  function installListeners(target: Window | ShadowRoot): void {
    target.addEventListener('click', captureClick, { capture: true })
    target.addEventListener('focusout', flushPendingKeydown, { capture: true })
    target.addEventListener('input', captureInput, { capture: true })
    target.addEventListener('keydown', captureKeydown, { capture: true })
    target.addEventListener('keyup', flushPendingKeydown, { capture: true })
  }

  function captureClick(event: Event): void {
    flushPendingKeydown()
    report(serializeInteraction(event, { kind: 'click' }))
  }

  function captureKeydown(event: Event): void {
    flushPendingKeydown()

    const keyboardEvent = event as KeyboardEvent
    const interaction = serializeInteraction(event, {
      code: keyboardEvent.code,
      key: keyboardEvent.key,
      kind: 'keydown',
      modifiers: modifiers(keyboardEvent),
      repeat: keyboardEvent.repeat,
    })
    const target = eventTarget(event)

    if (!interaction || !target) return
    if (!isEditable(target) || (keyboardEvent.key.length !== 1 && !deferredKeys.has(keyboardEvent.key))) return report(interaction)

    pendingEditableKeydown = { interaction, target }
  }

  function captureInput(event: Event): void {
    if (capturedEvents.has(event)) return
    capturedEvents.add(event)

    const target = eventTarget(event)
    if (!pendingEditableKeydown || pendingEditableKeydown.target !== target || !target) return

    const interaction = pendingEditableKeydown.interaction
    pendingEditableKeydown = undefined
    queueMicrotask(() =>
      report({
        ...interaction,
        event: { ...interaction.event, inputValue: editableValue(target) } as Extract<CapturedInteractionEvent, { kind: 'keydown' }>,
      }),
    )
  }

  function flushPendingKeydown(): void {
    if (!pendingEditableKeydown) return

    report(pendingEditableKeydown.interaction)
    pendingEditableKeydown = undefined
  }

  function serializeInteraction(event: Event, capturedEvent: CapturedInteractionEvent): SerializedInteraction | undefined {
    const targetPath = event.composedPath().filter((candidate): candidate is Element => candidate instanceof Element)
    const target = targetPath[0]

    if (!target || targetPath.some(candidate => candidate.hasAttribute(args.recorderUiAttribute)) || capturedEvents.has(event)) return

    capturedEvents.add(event)
    const { snapshot: ariaSnapshot, targetRef } = ariaRuntime.generateAriaSnapshot({ target, targetPath })

    return {
      ariaSnapshot,
      event: capturedEvent,
      selectors: generateLocatorCandidates(target, generateSelectorCandidates, ariaRuntime, {
        excludeElement: (element: Element) => element.hasAttribute(args.recorderUiAttribute) || Boolean(element.closest(`[${args.recorderUiAttribute}]`)),
        getShadowRoot: (element: Element) => element.shadowRoot ?? closedShadowRoots.get(element) ?? null,
      }),
      ...(targetRef ? { targetRef } : {}),
    }
  }

  function report(interaction: SerializedInteraction | undefined): void {
    if (!interaction) return

    void reportInteraction(interaction)
  }

  function eventTarget(event: Event): Element | undefined {
    return event.composedPath().find((candidate): candidate is Element => candidate instanceof Element)
  }

  function isEditable(target: Element): boolean {
    if (target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) return true

    return target instanceof HTMLInputElement && textInputTypes.has(target.type)
  }

  function editableValue(target: Element): string {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return target.value

    return (target as HTMLElement).innerText
  }

  function modifiers(event: KeyboardEvent): CapturedModifier[] {
    return [
      ['Alt', event.altKey],
      ['Control', event.ctrlKey],
      ['Meta', event.metaKey],
      ['Shift', event.shiftKey],
    ].flatMap(([modifier, active]) => (active && modifier !== event.key ? [modifier as CapturedModifier] : []))
  }
}

type CapturedModifier = NonNullable<Extract<CapturedInteractionEvent, { kind: 'keydown' }>['modifiers']>[number]

interface RecordPageInteractionsArgs {
  bindingName: string
  recorderUiAttribute: string
  selectorGeneratorName: string
}
