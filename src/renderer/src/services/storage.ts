import type { AppData, Collection, Environment, SyncConnection } from '../types/api'

const FALLBACK_KEY = 'api-studio-data'

export async function loadAppData(): Promise<AppData | null> {
  try {
    if (window.api?.loadData) {
      return await window.api.loadData()
    }
    const raw = window.localStorage.getItem(FALLBACK_KEY)
    return raw ? (JSON.parse(raw) as AppData) : null
  } catch {
    return null
  }
}

export async function saveAppData(
  collections: Collection[],
  environments: Environment[],
  activeEnvironmentId: string | null,
  sync: SyncConnection | null
): Promise<void> {
  const data: AppData = { collections, environments, activeEnvironmentId, ...(sync ? { sync } : {}) }
  try {
    if (window.api?.saveData) {
      await window.api.saveData(data)
      return
    }
    window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to persist app data', error)
  }
}
