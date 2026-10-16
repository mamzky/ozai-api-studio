import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { createDefaultCollections, createDefaultEnvironments } from '../data/defaultData'
import { loadAppData, saveAppData } from '../services/storage'
import type { Collection, Environment, SyncConnection } from '../types/api'

interface UseAppDataResult {
  collections: Collection[]
  setCollections: Dispatch<SetStateAction<Collection[]>>
  environments: Environment[]
  setEnvironments: Dispatch<SetStateAction<Environment[]>>
  activeEnvironmentId: string | null
  setActiveEnvironmentId: Dispatch<SetStateAction<string | null>>
  sync: SyncConnection | null
  setSync: Dispatch<SetStateAction<SyncConnection | null>>
  loaded: boolean
}

export function useAppData(): UseAppDataResult {
  const [collections, setCollections] = useState<Collection[]>([])
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string | null>(null)
  const [sync, setSync] = useState<SyncConnection | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadAppData().then((data) => {
      if (cancelled) return
      const nextCollections =
        data && data.collections && data.collections.length > 0 ? data.collections : createDefaultCollections()
      const nextEnvironments =
        data && data.environments && data.environments.length > 0
          ? data.environments
          : createDefaultEnvironments()
      const requestedActive = data?.activeEnvironmentId ?? null
      const nextActive = nextEnvironments.some((environment) => environment.id === requestedActive)
        ? requestedActive
        : nextEnvironments[0]?.id ?? null

      setCollections(nextCollections)
      setEnvironments(nextEnvironments)
      setActiveEnvironmentId(nextActive)
      setSync(data?.sync ?? null)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!loaded) return
    const handle = window.setTimeout(() => {
      void saveAppData(collections, environments, activeEnvironmentId, sync)
    }, 300)
    return () => window.clearTimeout(handle)
  }, [collections, environments, activeEnvironmentId, sync, loaded])

  return {
    collections,
    setCollections,
    environments,
    setEnvironments,
    activeEnvironmentId,
    setActiveEnvironmentId,
    sync,
    setSync,
    loaded
  }
}
