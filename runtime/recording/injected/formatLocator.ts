import type { CapturedSelector } from './types.ts'

export { formatLocator }

function formatLocator(locator: CapturedSelector): string {
  if (locator.kind === 'css') {
    return `locator(${JSON.stringify(locator.value)})`
  }

  return locator.steps
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
    .join('.')
}
