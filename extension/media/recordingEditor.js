const vscode = acquireVsCodeApi()
const app = document.querySelector('#app')

let recording
let pending = false
let selectedActionIndex = 0
let snapshotState = { loading: true }
let decisionBusy = false

window.addEventListener('message', event => {
  const message = event.data
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
    app.replaceChildren(createEmptyState('Could not open recording', message.message))
  } else if (message.type === 'decisionCancelled') {
    decisionBusy = false
    render()
  }
})

vscode.postMessage({ type: 'ready' })

function render() {
  if (!recording) {
    app.replaceChildren(createEmptyState('Opening recording…'))
    return
  }

  const header = element('header', 'recording-header')
  const heading = element('div', 'recording-heading')
  heading.append(element('h1', undefined, recording.title), element('div', 'start-url', recording.startUrl))
  heading.lastChild.title = recording.startUrl

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
    createButton('Play', pending ? undefined : 'primary', () => vscode.postMessage({ type: 'play' })),
    createButton('Open JSON', undefined, () => vscode.postMessage({ type: 'openJson' })),
  )
  header.append(heading, metadata, actions)

  const body = element('div', 'editor-body')
  body.append(renderActionList(), renderDetails())
  app.replaceChildren(header, body)
}

function renderActionList() {
  const sidebar = element('nav', 'action-sidebar')
  sidebar.setAttribute('aria-label', 'Recording steps')
  sidebar.append(element('h2', 'section-heading', 'Steps'))

  const list = element('ol', 'action-list')
  recording.actions.forEach((action, actionIndex) => {
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

function renderDetails() {
  const panel = element('section', 'detail-panel')
  const action = recording.actions[selectedActionIndex]
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

function renderLocators(locators) {
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
      createButton('Copy', 'small', event => {
        vscode.postMessage({ type: 'copy', text: value })
        const button = event.currentTarget
        button.textContent = 'Copied'
        window.setTimeout(() => (button.textContent = 'Copy'), 1200)
      }),
    )
    list.append(row)
  })
  section.append(list)
  return section
}

function renderSnapshot() {
  const section = element('section', 'detail-section snapshot-section')
  const heading = element('div', 'snapshot-heading')
  heading.append(element('h3', undefined, 'Accessibility snapshot'))
  section.append(heading)

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

function selectAction(actionIndex) {
  selectedActionIndex = actionIndex
  snapshotState = { loading: true }
  render()
  vscode.postMessage({ type: 'selectAction', actionIndex })
}

function decidePreview(type) {
  decisionBusy = true
  render()
  vscode.postMessage({ type })
}

function summarizeAction(action) {
  const target = locatorTarget(action.locatorCandidates?.[0])
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
    default:
      return action.kind
  }
}

function locatorTarget(locator) {
  if (!locator) {
    return 'element'
  }
  if (locator.kind === 'css') {
    return locator.value
  }
  const step = locator.steps.at(-1)
  if (step.method === 'role') {
    return step.name ? `${step.role} “${step.name}”` : step.role
  }
  return `“${step.text}”`
}

function formatLocator(locator) {
  const framePrefix = locator.framePath?.map(selector => `frameLocator(${JSON.stringify(selector)}).`).join('') ?? ''
  if (locator.kind === 'css') {
    return `${framePrefix}locator(${JSON.stringify(locator.value)})`
  }
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

function actionProperties(action) {
  const properties = []
  if (action.kind === 'fill') properties.push(['Value', formatValue(action.value)])
  if (action.kind === 'click' && action.button) properties.push(['Button', action.button])
  if (action.kind === 'click' && action.clickCount) properties.push(['Click count', String(action.clickCount)])
  if (action.modifiers?.length) properties.push(['Modifiers', action.modifiers.join(' + ')])
  if (action.position) properties.push(['Position', `${action.position.x}, ${action.position.y}`])
  if (action.kind === 'select') properties.push(['Options', action.options.join(', ')])
  if (action.kind === 'set-input-files') properties.push(['Files', action.files.join(', ')])
  return properties
}

function formatValue(value) {
  return value.kind === 'secret' ? `Secret: ${value.name}` : value.value
}

function actionKindLabel(kind) {
  return kind.replaceAll('-', ' ')
}

function displayUrl(value) {
  try {
    const url = new URL(value)
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}`
  } catch {
    return value
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function createButton(label, className, onClick) {
  const button = element('button', `button${className ? ` ${className}` : ''}`, label)
  button.type = 'button'
  button.addEventListener('click', onClick)
  return button
}

function createEmptyState(title, detail) {
  const state = element('div', 'empty-state')
  state.append(element('div', 'empty-title', title))
  if (detail) state.append(element('div', 'empty-detail', detail))
  return state
}

function element(tagName, className, text) {
  const node = document.createElement(tagName)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
