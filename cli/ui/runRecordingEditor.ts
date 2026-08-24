import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { type AddressInfo } from 'node:net'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

import { getRecordingSnapshotFileName, parseRecordingDocument, parseRecordingSnapshot, type RecordingDocument } from '@te/recorder-core'
import type { RecordingEditorHostMessage, RecordingEditorUiMessage } from '@te/recorder-ui/recording-editor'
import { createRecordingEditorHost } from '@te/recorder-ui/recording-editor-host'
import { renderRecordingSnapshot } from '@te/recorder-ui/render-recording-snapshot'

export { runRecordingEditor }
export type { RunRecordingEditorArgs }

const assetDirectory = fileURLToPath(new URL('../../ui/dist/browser/', import.meta.url))

async function runRecordingEditor(args: RunRecordingEditorArgs): Promise<void> {
  const documentPath = join(args.directoryPath, 'recording.json')
  const readDocument = async (): Promise<RecordingDocument> => parseRecordingDocument(JSON.parse(await readFile(documentPath, 'utf8')))
  await readDocument()

  const host = createRecordingEditorHost({
    isPending: () => false,
    readDocument,
    readSnapshot: async actionIndex => {
      const contents = await readFile(join(args.directoryPath, 'snapshots', getRecordingSnapshotFileName(actionIndex)), 'utf8')
      return renderRecordingSnapshot(parseRecordingSnapshot(JSON.parse(contents)))
    },
  })
  const routeToken = randomUUID()
  const server = createServer((request, response) => void handleRequest({ args, documentPath, host, request, response, routeToken }))

  try {
    await listen(server)
    const address = server.address() as AddressInfo
    const url = `http://127.0.0.1:${address.port}/${routeToken}/`
    await args.stdout.write(`Recording editor opened at ${url}\nClose its browser window to stop the server.\n`)
    await (args.openBrowser ?? openBrowser)(url)
  } finally {
    await closeServer(server)
  }
}

async function handleRequest(context: RequestContext): Promise<void> {
  const { request, response } = context
  const route = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
  const root = `/${context.routeToken}/`
  setSecurityHeaders(response)

  try {
    if (request.method === 'GET' && route === root) return send(response, 200, html(root), 'text/html; charset=utf-8')
    if (request.method === 'GET' && route === `${root}recordingEditor.js`) return send(response, 200, await readFile(join(assetDirectory, 'recordingEditor.js')), 'text/javascript; charset=utf-8')
    if (request.method === 'GET' && route === `${root}recordingEditor.css`) return send(response, 200, await readFile(join(assetDirectory, 'recordingEditor.css')), 'text/css; charset=utf-8')
    if (request.method === 'GET' && route === `${root}recording.json`) return send(response, 200, await readFile(context.documentPath), 'application/json; charset=utf-8')

    if (request.method === 'POST' && route === `${root}api/messages`) {
      const message = parseMessage(JSON.parse(await readBody(request)))
      const messages = await context.host.handleMessage(message)
      if (messages) return sendJson(response, 200, { messages })

      if (message.type === 'play') {
        try {
          await context.args.onPlay(parseRecordingDocument(JSON.parse(await readFile(context.documentPath, 'utf8'))))
          return sendJson(response, 200, {})
        } catch (error) {
          return sendJson(response, 200, { error: getErrorMessage(error) })
        }
      }

      return sendJson(response, 400, { error: `Unsupported recording editor message: ${message.type}` })
    }

    send(response, 404, 'Not found.', 'text/plain; charset=utf-8')
  } catch (error) {
    sendJson(response, 500, { error: getErrorMessage(error) })
  }
}

async function openBrowser(url: string): Promise<void> {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage({ colorScheme: null })

  try {
    await page.goto(url)
    await new Promise<void>(resolve => page.once('close', () => resolve()))
  } finally {
    await browser.close()
  }
}

function html(root: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src 'self'; script-src 'self'; style-src 'self'">
    <link rel="stylesheet" href="${root}recordingEditor.css">
    <title>Transaction Recording</title>
  </head>
  <body>
    <main id="app" aria-live="polite"></main>
    <script type="module" src="${root}recordingEditor.js"></script>
  </body>
</html>`
}

function parseMessage(value: unknown): RecordingEditorUiMessage {
  if (!value || typeof value !== 'object' || !('type' in value)) throw new Error('A recording editor message must have a type.')
  if (value.type === 'ready' || value.type === 'play') return { type: value.type }
  if (value.type === 'selectAction' && 'actionIndex' in value && Number.isInteger(value.actionIndex) && (value.actionIndex as number) >= 0) return { type: 'selectAction', actionIndex: value.actionIndex as number }
  throw new Error('Invalid recording editor message.')
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let length = 0

  for await (const chunk of request) {
    const buffer = Buffer.from(chunk)
    length += buffer.length
    if (length > 64 * 1024) throw new Error('The recording editor message was too large.')
    chunks.push(buffer)
  }

  return Buffer.concat(chunks).toString('utf8')
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
}

function sendJson(response: ServerResponse, status: number, body: MessageResponse): void {
  send(response, status, JSON.stringify(body), 'application/json; charset=utf-8')
}

function send(response: ServerResponse, status: number, body: string | Buffer, contentType: string): void {
  response.writeHead(status, { 'Content-Type': contentType })
  response.end(body)
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
}

function closeServer(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve()
  return new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface RunRecordingEditorArgs {
  directoryPath: string
  onPlay: (document: RecordingDocument) => Promise<void>
  openBrowser?: (url: string) => Promise<void>
  stdout: { write: (value: string) => Promise<unknown> | unknown }
}

interface RequestContext {
  args: RunRecordingEditorArgs
  documentPath: string
  host: { handleMessage: (message: RecordingEditorUiMessage) => Promise<RecordingEditorHostMessage[] | undefined> }
  request: IncomingMessage
  response: ServerResponse
  routeToken: string
}

interface MessageResponse {
  error?: string
  messages?: RecordingEditorHostMessage[]
}
