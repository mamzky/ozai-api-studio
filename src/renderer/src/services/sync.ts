import type {
  HistoryEntry,
  SyncCommitsResult,
  SyncConnection,
  SyncPullResult,
  SyncUploadResult,
  WorkspaceSnapshot
} from '../types/api'

const offline = (): { ok: false; code: 'offline'; error: string } => ({
  ok: false,
  code: 'offline',
  error: 'Cannot sync at the moment.'
})

export async function syncUpload(
  connection: SyncConnection,
  message: string,
  snapshot: WorkspaceSnapshot
): Promise<SyncUploadResult> {
  if (!window.api?.syncUpload) return offline()
  return window.api.syncUpload({
    url: connection.url,
    password: connection.password,
    author: connection.author,
    message,
    snapshot
  })
}

export async function syncPull(connection: SyncConnection): Promise<SyncPullResult> {
  if (!window.api?.syncPull) return offline()
  return window.api.syncPull({ url: connection.url, password: connection.password })
}

export async function syncCommits(connection: SyncConnection): Promise<SyncCommitsResult> {
  if (!window.api?.syncCommits) return offline()
  return window.api.syncCommits({ url: connection.url, password: connection.password })
}

export async function syncTest(connection: { url: string; password: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!window.api?.syncTest) return { ok: false, error: 'Cannot sync at the moment.' }
  return window.api.syncTest({ url: connection.url, password: connection.password })
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  if (!window.api?.loadHistory) return []
  return window.api.loadHistory()
}

export async function saveHistory(entries: HistoryEntry[]): Promise<void> {
  if (!window.api?.saveHistory) return
  await window.api.saveHistory(entries)
}
