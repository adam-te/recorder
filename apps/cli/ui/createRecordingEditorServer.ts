import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { type AddressInfo } from 'node:net'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RecordingEditorPresenterMessage, RecordingEditorUiMessage } from '@te/recorder-ui/recording-editor/host'
import { tryTo } from '@te/recorder-utils'

export { createRecordingEditorServer }
export type { RecordingEditorServer, RecordingEditorServerMessage, RecordingEditorServerResponse }

const assetDirectory = fileURLToPath(new URL('../dist/ui/', import.meta.url))

async function createRecordingEditorServer(args: CreateRecordingEditorServerArgs): Promise<RecordingEditorServer> {
  const routeToken = randomUUID()
  const server = createServer((request, response) => void handleRequest({ ...args, request, response, routeToken }))

  await listen(server)

  return {
    close: () => closeServer(server),
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/${routeToken}/`,
  }
}

async function handleRequest(context: RequestContext): Promise<void> {
  const { request, response } = context
  const route = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
  const root = `/${context.routeToken}/`
  setSecurityHeaders(response)

  await tryTo(
    async () => {
      if (request.method === 'GET' && route === root) return send(response, 200, html(root), 'text/html; charset=utf-8')
      if (request.method === 'GET' && route === `${root}recordingEditor.js`) return send(response, 200, await readFile(join(assetDirectory, 'recordingEditor.js')), 'text/javascript; charset=utf-8')
      if (request.method === 'GET' && route === `${root}recordingEditor.css`) return send(response, 200, await readFile(join(assetDirectory, 'recordingEditor.css')), 'text/css; charset=utf-8')
      if (request.method === 'GET' && route === `${root}recording.json`) return send(response, 200, await context.loadRecordingDocument(), 'application/json; charset=utf-8')

      if (request.method === 'POST' && route === `${root}api/messages`) {
        return sendJson(response, 200, await context.handleMessage(parseMessage(JSON.parse(await readBody(request)))))
      }

      send(response, 404, 'Not found.', 'text/plain; charset=utf-8')
    },
    error => sendJson(response, 500, { error: getErrorMessage(error) }),
  )
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

function parseMessage(value: unknown): RecordingEditorServerMessage {
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

function sendJson(response: ServerResponse, status: number, body: RecordingEditorServerResponse): void {
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

interface CreateRecordingEditorServerArgs {
  handleMessage: (message: RecordingEditorServerMessage) => Promise<RecordingEditorServerResponse>
  loadRecordingDocument: () => Promise<string>
}

interface RecordingEditorServer {
  close: () => Promise<void>
  url: string
}

type RecordingEditorServerMessage = Extract<RecordingEditorUiMessage, { type: 'ready' | 'selectAction' }> | { type: 'play' }

interface RecordingEditorServerResponse {
  error?: string
  messages?: RecordingEditorPresenterMessage[]
}

interface RequestContext extends CreateRecordingEditorServerArgs {
  request: IncomingMessage
  response: ServerResponse
  routeToken: string
}
