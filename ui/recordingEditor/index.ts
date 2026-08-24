import type { RecordedAction, RecordedLocator, RecordedValue, RecordingDocument } from '@te/recorder-core'

export { createRecordingEditor }
export type { RecordingEditor, RecordingEditorHostMessage, RecordingEditorUiMessage }

function createRecordingEditor(args: CreateRecordingEditorArgs): RecordingEditor {
  let recording: RecordingDocument | undefined
  let pending = false
  let selectedActionIndex = 0
  let snapshotState: SnapshotState = { loading: true }
  let decisionBusy = false

  return { ready: () => args.sendMessage({ type: 'ready' }), receive }

  function receive(message: RecordingEditorHostMessage): void {
    if (message.type === 'document') {
      recording = message.document
      pending = message.pending
      selectedActionIndex = message.selectedActionIndex
      snapshotState = { loading: true }
      render()
    } else if (message.type === 'snapshot' && message.actionIndex === selectedActionIndex) {
      snapshotState = { error: message.error, targetLine: message.targetLine, yaml: message.yaml }
      render()
    } else if (message.type === 'error') {
      args.root.replaceChildren(createEmptyState('Could not open recording', message.message))
    } else if (message.type === 'decisionCancelled') {
      decisionBusy = false
      render()
    }
  }

  function render(): void {
    if (!recording) {
      args.root.replaceChildren(createEmptyState('Opening recording…'))
      return
    }

    const header = element('header', 'recording-header')
    const heading = element('div', 'recording-heading')
    const startUrl = element('div', 'start-url', recording.startUrl)
    startUrl.title = recording.startUrl
    heading.append(element('h1', undefined, recording.title), startUrl)

    const metadata = element('div', 'metadata', `${recording.actions.length} steps · ${formatDate(recording.createdAt)}`)
    const actions = element('div', 'header-actions')
    if (pending) {
      const discard = createButton('Discard', undefined, () => decidePreview('discard'))
      const save = createButton(decisionBusy ? 'Working…' : 'Save Recording', 'primary', () => decidePreview('save'))
      discard.disabled = decisionBusy
      save.disabled = decisionBusy
      actions.append(discard, save)
    }
    actions.append(
      createButton('Play', pending ? undefined : 'primary', () => args.sendMessage({ type: 'play' })),
      createButton('Open JSON', undefined, () => args.sendMessage({ type: 'openJson' })),
    )
    header.append(heading, metadata, actions)

    const body = element('div', 'editor-body')
    body.append(renderActionList(recording), renderDetails(recording))
    args.root.replaceChildren(header, body)
  }

  function renderActionList(document: RecordingDocument): HTMLElement {
    const sidebar = element('nav', 'action-sidebar')
    sidebar.setAttribute('aria-label', 'Recording steps')
    sidebar.append(element('h2', 'section-heading', 'Steps'))

    const list = element('ol', 'action-list')
    document.actions.forEach((action, actionIndex) => {
      const item = element('li')
      const button = element('button', `action-row${actionIndex === selectedActionIndex ? ' selected' : ''}`)
      button.type = 'button'
      button.addEventListener('click', () => selectAction(actionIndex))
      button.append(element('span', 'action-number', String(actionIndex + 1)), element('span', `action-kind kind-${action.kind}`, actionKindLabel(action.kind)), element('span', 'action-summary', summarizeAction(action)))
      item.append(button)
      list.append(item)
    })
    sidebar.append(list)
    return sidebar
  }

  function renderDetails(document: RecordingDocument): HTMLElement {
    const panel = element('section', 'detail-panel')
    const action = document.actions[selectedActionIndex]
    if (!action) {
      panel.append(createEmptyState('This recording has no actions.'))
      return panel
    }

    const title = element('div', 'detail-title')
    title.append(element('div', 'eyebrow', `Step ${selectedActionIndex + 1}`), element('h2', undefined, summarizeAction(action)))
    panel.append(title)

    const page = element('div', 'page-url')
    page.append(element('span', 'field-label', 'Page'), element('span', 'field-value', action.pageUrl))
    panel.append(page)

    const properties = actionProperties(action)
    if (properties.length > 0) {
      const propertyList = element('dl', 'property-list')
      for (const [label, value] of properties) {
        propertyList.append(element('dt', undefined, label), element('dd', undefined, value))
      }
      panel.append(propertyList)
    }

    if ('locatorCandidates' in action) {
      panel.append(renderLocators(action.locatorCandidates), renderSnapshot())
    } else {
      panel.append(createEmptyState('No accessibility snapshot for navigation actions.', 'Snapshots are captured for actions that interact with an element.'))
    }
    return panel
  }

  function renderLocators(locators: RecordedLocator[]): HTMLElement {
    const section = element('section', 'detail-section')
    section.append(element('h3', undefined, 'Locator candidates'))
    const list = element('ol', 'locator-list')
    locators.forEach((locator, index) => {
      const value = formatLocator(locator)
      const row = element('li', 'locator-row')
      const main = element('div', 'locator-main')
      main.append(element('span', 'locator-rank', index === 0 ? 'Preferred' : `Alternative ${index}`), element('code', undefined, value))
      row.append(
        main,
        createButton('Copy', 'small', button => {
          args.sendMessage({ type: 'copy', text: value })
          button.textContent = 'Copied'
          window.setTimeout(() => (button.textContent = 'Copy'), 1200)
        }),
      )
      list.append(row)
    })
    section.append(list)
    return section
  }

  function renderSnapshot(): HTMLElement {
    const section = element('section', 'detail-section snapshot-section')
    section.append(element('h3', undefined, 'Accessibility snapshot'))

    if (snapshotState.loading) {
      section.append(createEmptyState('Loading snapshot…'))
      return section
    }
    if (snapshotState.error) {
      section.append(createEmptyState('Snapshot unavailable', snapshotState.error))
      return section
    }
    if (snapshotState.yaml === undefined) {
      section.append(createEmptyState('No snapshot recorded for this action.'))
      return section
    }

    const pre = element('pre', 'snapshot-yaml')
    const code = element('code')
    for (const [lineIndex, line] of snapshotState.yaml.split('\n').entries()) {
      code.append(element('span', lineIndex === snapshotState.targetLine ? 'yaml-line target-line' : 'yaml-line', line))
    }
    pre.append(code)
    section.append(pre)
    return section
  }

  function selectAction(actionIndex: number): void {
    selectedActionIndex = actionIndex
    snapshotState = { loading: true }
    render()
    args.sendMessage({ type: 'selectAction', actionIndex })
  }

  function decidePreview(type: 'discard' | 'save'): void {
    decisionBusy = true
    render()
    args.sendMessage({ type })
  }
}

function summarizeAction(action: RecordedAction): string {
  const target = locatorTarget('locatorCandidates' in action ? action.locatorCandidates[0] : undefined)
  switch (action.kind) {
    case 'goto':
      return `Navigate to ${displayUrl(action.url)}`
    case 'go-back':
      return 'Go back'
    case 'go-forward':
      return 'Go forward'
    case 'reload':
      return 'Reload the page'
    case 'click':
      return `Click ${target}`
    case 'fill':
      return `Fill ${target}`
    case 'check':
      return `${action.checked ? 'Check' : 'Uncheck'} ${target}`
    case 'press':
      return `Press ${[...(action.modifiers ?? []), action.key].join('+')} on ${target}`
    case 'select':
      return `Select ${action.options.map(value => `“${value}”`).join(', ')} in ${target}`
    case 'hover':
      return `Hover over ${target}`
    case 'set-input-files':
      return `Choose ${action.files.length} file${action.files.length === 1 ? '' : 's'} in ${target}`
    case 'assert-visible':
      return `Verify ${target} is visible`
  }
}

function locatorTarget(locator: RecordedLocator | undefined): string {
  if (!locator) return 'element'
  if (locator.kind === 'css') return locator.value

  const step = locator.steps.at(-1)
  if (!step) return 'element'
  if (step.method === 'role') return step.name ? `${step.role} “${step.name}”` : step.role
  return `“${step.text}”`
}

function formatLocator(locator: RecordedLocator): string {
  const framePrefix = locator.framePath?.map(selector => `frameLocator(${JSON.stringify(selector)}).`).join('') ?? ''
  if (locator.kind === 'css') return `${framePrefix}locator(${JSON.stringify(locator.value)})`

  return `${framePrefix}${locator.steps
    .map(step => {
      if (step.method === 'label') {
        const options = step.exact === undefined ? '' : `, { exact: ${step.exact} }`
        return `getByLabel(${JSON.stringify(step.text)}${options})`
      }
      const options = []
      if (step.name !== undefined) options.push(`name: ${JSON.stringify(step.name)}`)
      if (step.exact !== undefined) options.push(`exact: ${step.exact}`)
      return `getByRole(${JSON.stringify(step.role)}${options.length ? `, { ${options.join(', ')} }` : ''})`
    })
    .join('.')}`
}

function actionProperties(action: RecordedAction): [string, string][] {
  const properties: [string, string][] = []
  if (action.kind === 'fill') properties.push(['Value', formatValue(action.value)])
  if (action.kind === 'click' && action.button) properties.push(['Button', action.button])
  if (action.kind === 'click' && action.clickCount) properties.push(['Click count', String(action.clickCount)])
  if ('modifiers' in action && action.modifiers?.length) properties.push(['Modifiers', action.modifiers.join(' + ')])
  if ('position' in action && action.position) properties.push(['Position', `${action.position.x}, ${action.position.y}`])
  if (action.kind === 'select') properties.push(['Options', action.options.join(', ')])
  if (action.kind === 'set-input-files') properties.push(['Files', action.files.join(', ')])
  return properties
}

function formatValue(value: RecordedValue): string {
  return value.kind === 'secret' ? `Secret: ${value.name}` : value.value
}

function actionKindLabel(kind: RecordedAction['kind']): string {
  return kind.replaceAll('-', ' ')
}

function displayUrl(value: string): string {
  try {
    const url = new URL(value)
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}`
  } catch {
    return value
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function createButton(label: string, className: string | undefined, onClick: (button: HTMLButtonElement) => void): HTMLButtonElement {
  const button = element('button', `button${className ? ` ${className}` : ''}`, label)
  button.type = 'button'
  button.addEventListener('click', () => onClick(button))
  return button
}

function createEmptyState(title: string, detail?: string): HTMLElement {
  const state = element('div', 'empty-state')
  state.append(element('div', 'empty-title', title))
  if (detail) state.append(element('div', 'empty-detail', detail))
  return state
}

function element<K extends keyof HTMLElementTagNameMap>(tagName: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tagName)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

interface CreateRecordingEditorArgs {
  root: HTMLElement
  sendMessage: (message: RecordingEditorUiMessage) => void
}

interface RecordingEditor {
  ready: () => void
  receive: (message: RecordingEditorHostMessage) => void
}

type RecordingEditorHostMessage = { type: 'decisionCancelled' } | { message: string; type: 'error' } | { document: RecordingDocument; pending: boolean; selectedActionIndex: number; type: 'document' } | { actionIndex: number; error?: string; targetLine?: number; type: 'snapshot'; yaml?: string }

type RecordingEditorUiMessage = { type: 'copy'; text: string } | { type: 'discard' | 'openJson' | 'play' | 'ready' | 'save' } | { type: 'selectAction'; actionIndex: number }

interface SnapshotState {
  error?: string
  loading?: boolean
  targetLine?: number
  yaml?: string
}
