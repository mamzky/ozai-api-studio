/// <reference types="vite/client" />

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

declare global {
  interface Window {
    api: {
      platform: string
      electronVersion: string
      sendRequest: (payload: HttpRequestPayload) => Promise<SendResult>
      readClipboard: () => Promise<string>
      loadData: () => Promise<AppData | null>
      saveData: (data: AppData) => Promise<boolean>
      syncUpload: (payload: {
        url: string
        password: string
        author: string
        message: string
        project: string
        snapshot: WorkspaceSnapshot
      }) => Promise<SyncUploadResult>
      syncPull: (payload: { url: string; password: string; project: string }) => Promise<SyncPullResult>
      syncCommits: (payload: {
        url: string
        password: string
        project: string
        limit?: number
      }) => Promise<SyncCommitsResult>
      syncTest: (payload: { url: string; password: string }) => Promise<{ ok: true } | { ok: false; error: string }>
      loadHistory: () => Promise<HistoryEntry[]>
      saveHistory: (entries: HistoryEntry[]) => Promise<boolean>
    }
  }
}

export {}
