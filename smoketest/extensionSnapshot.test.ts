import { describe, expect, test } from 'vitest'

import { renderRecordingSnapshot } from '@te/recorder-ui/render-recording-snapshot'

describe('extension snapshot rendering', () => {
  test('hides internal refs and preserves the target line', () => {
    const rendered = renderRecordingSnapshot({
      children: [
        { name: 'Cancel', props: {}, ref: 'e1', role: 'button' },
        { cursor: 'pointer', name: 'Save', props: {}, ref: 'e2', role: 'button', target: true },
      ],
      name: '',
      props: {},
      role: 'fragment',
    })

    expect(rendered).toStrictEqual({ targetLine: 1, yaml: '- button "Cancel"\n- button "Save" [cursor=pointer]' })
  })

  test('does not strip ref-like text from accessible names', () => {
    const rendered = renderRecordingSnapshot({ children: [{ name: 'Show [ref=help]', props: {}, ref: 'e1', role: 'button' }], name: '', props: {}, role: 'fragment' })

    expect(rendered.yaml).toBe('- button "Show [ref=help]"')
  })

  test('does not mistake ref-like accessible names for the target line', () => {
    const rendered = renderRecordingSnapshot({
      children: [
        { name: 'Show [ref=e2]', props: {}, ref: 'e1', role: 'button' },
        { name: 'Save', props: {}, ref: 'e2', role: 'button', target: true },
      ],
      name: '',
      props: {},
      role: 'fragment',
    })

    expect(rendered.targetLine).toBe(1)
  })
})
