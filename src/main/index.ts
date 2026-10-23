import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync, promises as fs } from 'fs'
import { uploadWorkspace, pullWorkspace, listCommits, testConnection } from './supabase'
import type {
  AppData,
  HistoryEntry,
  HttpRequestPayload,
  ResponseHeader,
  SendResult,
  WorkspaceSnapshot
} from '@shared/types'

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout'
}

const storageFile = (): string => join(app.getPath('userData'), 'api-studio.json')

const historyFile = (): string => join(app.getPath('userData'), 'api-studio-history.json')

const LEGACY_APP_NAME = 'api-studio'

async function migrateLegacyData(): Promise<void> {
  try {
    const legacyDir = join(app.getPath('appData'), LEGACY_APP_NAME)
    const currentDir = app.getPath('userData')
    if (legacyDir === currentDir) return
    if (!existsSync(legacyDir)) return

    await fs.mkdir(currentDir, { recursive: true })
    for (const name of ['api-studio.json', 'api-studio-history.json']) {
      const destination = join(currentDir, name)
      if (existsSync(destination)) continue
      const source = join(legacyDir, name)
      if (existsSync(source)) await fs.copyFile(source, destination)
    }
  } catch {
    // ignore migration errors
  }
}

async function runRequest(payload: HttpRequestPayload): Promise<SendResult> {
  let url: URL
  try {
    url = new URL(payload.url)
  } catch {
    return { ok: false, error: { kind: 'invalid-url', message: 'Invalid URL.' } }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: { kind: 'invalid-url', message: 'Invalid URL.' } }
  }

  const controller = new AbortController()
  const timeoutMs = payload.timeoutMs && payload.timeoutMs > 0 ? payload.timeoutMs : 30000
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()
  const hasBody = payload.method !== 'GET' && payload.method !== 'HEAD' && payload.body !== undefined

  try {
    const response = await fetch(url.toString(), {
      method: payload.method,
      headers: payload.headers,
      body: hasBody ? payload.body : undefined,
      signal: controller.signal,
      redirect: 'follow'
    })

    const text = await response.text()
    const duration = Date.now() - startedAt

    const headers: ResponseHeader[] = []
    response.headers.forEach((value, key) => headers.push({ key, value }))

    return {
      ok: true,
      response: {
        status: response.status,
        statusText: response.statusText || STATUS_TEXT[response.status] || '',
        headers,
        body: text,
        timeMs: duration,
        sizeKb: Buffer.byteLength(text, 'utf8') / 1024
      }
    }
  } catch (error) {
    const isAbort = (error as Error)?.name === 'AbortError'
    if (isAbort) {
      return {
        ok: false,
        error: { kind: 'timeout', message: 'Request Timeout', detail: 'The server took too long to respond.' }
      }
    }
    return {
      ok: false,
      error: { kind: 'network', message: 'Request Failed', detail: (error as Error)?.message }
    }
  } finally {
    clearTimeout(timer)
  }
}

function registerIpc(): void {
  ipcMain.handle('request:send', (_event, payload: HttpRequestPayload) => runRequest(payload))

  ipcMain.handle('storage:load', async (): Promise<AppData | null> => {
    try {
      const raw = await fs.readFile(storageFile(), 'utf8')
      const parsed = JSON.parse(raw) as AppData
      return parsed && Array.isArray(parsed.collections) ? parsed : null
    } catch {
      return null
    }
  })

  ipcMain.handle('storage:save', async (_event, data: AppData): Promise<boolean> => {
    try {
      await fs.writeFile(storageFile(), JSON.stringify(data, null, 2), 'utf8')
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle(
    'sync:upload',
    (
      _event,
      payload: { url: string; password: string; author: string; message: string; snapshot: WorkspaceSnapshot }
    ) => uploadWorkspace(payload.url, payload.password, payload.author, payload.message, payload.snapshot)
  )

  ipcMain.handle('sync:pull', (_event, payload: { url: string; password: string }) =>
    pullWorkspace(payload.url, payload.password)
  )

  ipcMain.handle('sync:commits', (_event, payload: { url: string; password: string; limit?: number }) =>
    listCommits(payload.url, payload.password, payload.limit)
  )

  ipcMain.handle('sync:test', (_event, payload: { url: string; password: string }) =>
    testConnection(payload.url, payload.password)
  )

  ipcMain.handle('history:load', async (): Promise<HistoryEntry[]> => {
    try {
      const raw = await fs.readFile(historyFile(), 'utf8')
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : []
    } catch {
      return []
    }
  })

  ipcMain.handle('history:save', async (_event, entries: HistoryEntry[]): Promise<boolean> => {
    try {
      await fs.writeFile(historyFile(), JSON.stringify(entries, null, 2), 'utf8')
      return true
    } catch {
      return false
    }
  })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 640,
    show: false,
    backgroundColor: '#0b0e14',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await migrateLegacyData()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
