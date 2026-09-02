export { quoteJavaScriptString }

function quoteJavaScriptString(value: string): string {
  return JSON.stringify(value).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029')
}
