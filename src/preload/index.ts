import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppData,
  HistoryEntry,
  HttpRequestPayload,
  SendResult,
  SyncCommitsResult,
  SyncPullResult,
  SyncUploadResult,
  WorkspaceSnapshot
} from '@shared/types'

const api = {
  platform: process.platform,
  electronVersion: process.versions.electron,
  sendRequest: (payload: HttpRequestPayload): Promise<SendResult> =>
    ipcRenderer.invoke('request:send', payload),
  readClipboard: (): Promise<string> => ipcRenderer.invoke('clipboard:read'),
  loadData: (): Promise<AppData | null> => ipcRenderer.invoke('storage:load'),
  saveData: (data: AppData): Promise<boolean> => ipcRenderer.invoke('storage:save', data),
  syncUpload: (payload: {
    url: string
    password: string
    author: string
    message: string
    snapshot: WorkspaceSnapshot
  }): Promise<SyncUploadResult> => ipcRenderer.invoke('sync:upload', payload),
  syncPull: (payload: { url: string; password: string }): Promise<SyncPullResult> =>
    ipcRenderer.invoke('sync:pull', payload),
  syncCommits: (payload: { url: string; password: string; limit?: number }): Promise<SyncCommitsResult> =>
    ipcRenderer.invoke('sync:commits', payload),
  syncTest: (payload: { url: string; password: string }): Promise<{ ok: true } | { ok: false; error: string }> =>
    ipcRenderer.invoke('sync:test', payload),
  loadHistory: (): Promise<HistoryEntry[]> => ipcRenderer.invoke('history:load'),
  saveHistory: (entries: HistoryEntry[]): Promise<boolean> => ipcRenderer.invoke('history:save', entries)
}

contextBridge.exposeInMainWorld('api', api)

export type StudioApi = typeof api
