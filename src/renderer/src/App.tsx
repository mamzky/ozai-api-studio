import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react'
import TopBar from './components/TopBar'
import Sidebar from './components/Sidebar'
import RequestEditor from './components/RequestEditor'
import ResponseViewer from './components/ResponseViewer'
import ContextMenu, { type ContextMenuItem } from './components/ContextMenu'
import ConfirmDialog from './components/ConfirmDialog'
import PromptDialog from './components/PromptDialog'
import EnvironmentsModal from './components/EnvironmentsModal'
import SyncDialog from './components/SyncDialog'
import HistoryDialog from './components/HistoryDialog'
import WorkspaceImportDialog from './components/WorkspaceImportDialog'
import ExampleDialog from './components/ExampleDialog'
import { Bolt, Plus } from './components/Icons'
import { createRequest, findRequest } from './data/defaultData'
import { useAppData } from './hooks/useAppData'
import { byteSize, uid } from './lib/format'
import { buildFinalUrl, buildHeaders, encodeBase64, isHttpUrl, validateJsonBody } from './lib/request'
import { buildVariableMap, interpolate, resolveUrl } from './lib/environments'
import { applyLocalSecrets, sanitizeEnvironments } from './lib/secrets'
import { statusTextFor } from './lib/status'
import { loadHistory, saveHistory, syncPull, syncTest, syncUpload } from './services/sync'
import { sendMockRequest } from './services/mock'
import { parseOpenApiCollections } from './lib/openapi'
import {
  mergeImportedWorkspace,
  parseWorkspaceExport,
  type ImportedWorkspace,
  type WorkspaceImportMode,
  type WorkspaceMergeResult
} from './lib/workspace'
import type {
  ApiRequest,
  ApiResponse,
  Collection,
  HistoryEntry,
  RequestError,
  RequestExample,
  WorkspaceSnapshot
} from './types/api'

interface MenuState {
  x: number
  y: number
  items: ContextMenuItem[]
}

interface ConfirmState {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
}

interface PendingWorkspaceImport {
  workspace: ImportedWorkspace
  merge: WorkspaceMergeResult
  replace: WorkspaceMergeResult
}

interface ExampleDialogState {
  requestId: string
  collectionId: string
  defaultName: string
  response: ApiResponse
}

interface RenameTarget {
  type: 'collection' | 'request'
  id: string
}

interface PromptState {
  title: string
  message: string
  defaultValue: string
  onSubmit: (value: string) => void
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl border border-studio-border bg-studio-panel text-studio-muted">
        <Bolt className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-studio-text">No request selected</p>
        <p className="mt-1 text-xs text-studio-muted">Create a new request to get started.</p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="btn mt-1 border border-studio-border bg-studio-panel text-studio-muted hover:bg-studio-strong/50 hover:text-studio-text"
      >
        <Plus className="h-3.5 w-3.5" />
        New Request
      </button>
    </div>
  )
}

export default function App() {
  const {
    collections,
    setCollections,
    environments,
    setEnvironments,
    activeEnvironmentId,
    setActiveEnvironmentId,
    sync,
    setSync,
    loaded
  } = useAppData()
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [workspace, setWorkspace] = useState('My Workspace')
  const [responses, setResponses] = useState<Record<string, ApiResponse>>({})
  const [errors, setErrors] = useState<Record<string, RequestError | null>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [workspaceImport, setWorkspaceImport] = useState<PendingWorkspaceImport | null>(null)
  const [exampleDialog, setExampleDialog] = useState<ExampleDialogState | null>(null)
  const [renaming, setRenaming] = useState<RenameTarget | null>(null)
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(null)
  const [prompt, setPrompt] = useState<PromptState | null>(null)
  const [envModalOpen, setEnvModalOpen] = useState(false)
  const [syncMode, setSyncMode] = useState<'upload' | 'import' | null>(null)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [responsePct, setResponsePct] = useState(42)
  const initializedRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const splitRef = useRef<HTMLDivElement>(null)

  const active = useMemo(() => findRequest(collections, selectedRequestId), [collections, selectedRequestId])
  const activeExample = useMemo(() => {
    if (!active || !selectedExampleId) return null
    return active.request.examples?.find((example) => example.id === selectedExampleId) ?? null
  }, [active, selectedExampleId])
  const exampleResponse = useMemo<ApiResponse | null>(() => {
    if (!activeExample) return null
    return {
      status: activeExample.status,
      statusText: activeExample.statusText,
      headers: activeExample.headers,
      body: activeExample.body,
      timeMs: 0,
      sizeKb: byteSize(activeExample.body),
      example: true
    }
  }, [activeExample])
  const activeEnvironment = useMemo(
    () => environments.find((environment) => environment.id === activeEnvironmentId) ?? null,
    [environments, activeEnvironmentId]
  )

  useEffect(() => {
    if (!loaded || initializedRef.current) return
    initializedRef.current = true
    const collection = collections[0]
    const request = collection?.requests[0]
    if (collection) setExpanded((prev) => ({ ...prev, [collection.id]: true }))
    if (request && collection) {
      setSelectedCollectionId(collection.id)
      setSelectedRequestId(request.id)
    }
  }, [loaded, collections])

  useEffect(() => {
    void loadHistory().then(setHistoryEntries)
  }, [])

  const toggleCollection = useCallback((collectionId: string) => {
    setExpanded((prev) => ({ ...prev, [collectionId]: !prev[collectionId] }))
  }, [])

  const updateActiveRequest = useCallback(
    (patch: Partial<ApiRequest>) => {
      if (!selectedRequestId) return
      setSelectedExampleId(null)
      setCollections((prev) =>
        prev.map((collection) => ({
          ...collection,
          requests: collection.requests.map((request) => {
            if (request.id !== selectedRequestId) return request
            const next = { ...request, ...patch }
            if (patch.body && patch.body.format === 'json') {
              const hasContentType = next.headers.some(
                (header) => header.enabled && header.key.trim().toLowerCase() === 'content-type'
              )
              if (!hasContentType) {
                next.headers = [
                  ...next.headers,
                  { id: uid('kv'), key: 'Content-Type', value: 'application/json', description: '', enabled: true }
                ]
              }
            }
            return next
          })
        }))
      )
    },
    [selectedRequestId, setCollections]
  )

  const handleSelectRequest = useCallback(
    (requestId: string) => {
      setSelectedRequestId(requestId)
      setSelectedExampleId(null)
      const found = findRequest(collections, requestId)
      if (found) {
        setSelectedCollectionId(found.collection.id)
        setExpanded((prev) => ({ ...prev, [found.collection.id]: true }))
      }
    },
    [collections]
  )

  const handleSelectCollection = useCallback((collectionId: string) => {
    setSelectedCollectionId(collectionId)
    setSelectedExampleId(null)
  }, [])

  const handleSelectExample = useCallback(
    (exampleId: string, requestId: string) => {
      const found = findRequest(collections, requestId)
      if (!found) return
      setSelectedRequestId(requestId)
      setSelectedCollectionId(found.collection.id)
      setSelectedExampleId(exampleId)
      setExpanded((prev) => ({
        ...prev,
        [found.collection.id]: true,
        [`ex:${requestId}`]: true
      }))
    },
    [collections]
  )

  const handleNewCollection = useCallback(() => {
    const collection: Collection = { id: uid('col'), name: 'New Collection', requests: [] }
    setCollections((prev) => [...prev, collection])
    setExpanded((prev) => ({ ...prev, [collection.id]: true }))
    setSelectedCollectionId(collection.id)
    setSelectedRequestId(null)
    setSelectedExampleId(null)
    setRenaming({ type: 'collection', id: collection.id })
  }, [setCollections])

  const handleNewRequest = useCallback(
    (collectionId: string) => {
      const request = createRequest()
      setSelectedExampleId(null)
      const targetId = collectionId || collections[0]?.id

      if (!targetId) {
        const newCollectionId = uid('col')
        setCollections((prev) => [
          ...prev,
          { id: newCollectionId, name: 'New Collection', requests: [request] }
        ])
        setExpanded((prev) => ({ ...prev, [newCollectionId]: true }))
        setSelectedCollectionId(newCollectionId)
        setSelectedRequestId(request.id)
        setRenaming({ type: 'request', id: request.id })
        return
      }

      setCollections((prev) =>
        prev.map((collection) =>
          collection.id === targetId
            ? { ...collection, requests: [...collection.requests, request] }
            : collection
        )
      )
      setExpanded((prev) => ({ ...prev, [targetId]: true }))
      setSelectedCollectionId(targetId)
      setSelectedRequestId(request.id)
      setRenaming({ type: 'request', id: request.id })
    },
    [collections, setCollections]
  )

  const handleRenameCollection = useCallback(
    (collectionId: string, name: string) => {
      setCollections((prev) =>
        prev.map((collection) => (collection.id === collectionId ? { ...collection, name } : collection))
      )
      setRenaming(null)
    },
    [setCollections]
  )

  const handleRenameRequest = useCallback(
    (requestId: string, name: string) => {
      setCollections((prev) =>
        prev.map((collection) => ({
          ...collection,
          requests: collection.requests.map((request) =>
            request.id === requestId ? { ...request, name } : request
          )
        }))
      )
      setRenaming(null)
    },
    [setCollections]
  )

  const handleDuplicateRequest = useCallback(
    (requestId: string) => {
      const found = findRequest(collections, requestId)
      if (!found) return
      const original = found.request
      const copy: ApiRequest = {
        ...original,
        id: uid('req'),
        name: `${original.name} Copy`,
        params: original.params.map((param) => ({ ...param, id: uid('kv') })),
        headers: original.headers.map((header) => ({ ...header, id: uid('kv') })),
        auth: { ...original.auth },
        body: { ...original.body },
        examples: original.examples?.map((example) => ({
          ...example,
          id: uid('ex'),
          headers: example.headers.map((header) => ({ ...header })),
          request: {
            ...example.request,
            params: example.request.params.map((param) => ({ ...param, id: uid('kv') })),
            headers: example.request.headers.map((header) => ({ ...header, id: uid('kv') })),
            auth: { ...example.request.auth },
            body: { ...example.request.body }
          }
        }))
      }
      setCollections((prev) =>
        prev.map((collection) => {
          const index = collection.requests.findIndex((request) => request.id === requestId)
          if (index === -1) return collection
          const requests = [...collection.requests]
          requests.splice(index + 1, 0, copy)
          return { ...collection, requests }
        })
      )
      setExpanded((prev) => ({ ...prev, [found.collection.id]: true }))
      setSelectedCollectionId(found.collection.id)
      setSelectedRequestId(copy.id)
      setSelectedExampleId(null)
    },
    [collections, setCollections]
  )

  const handleDeleteRequest = useCallback(
    (requestId: string) => {
      const found = findRequest(collections, requestId)
      if (!found) return
      setConfirm({
        title: 'Delete Request?',
        message: `Are you sure you want to delete "${found.request.name}"?`,
        confirmLabel: 'Delete',
        onConfirm: () => {
          setCollections((prev) =>
            prev.map((collection) => ({
              ...collection,
              requests: collection.requests.filter((request) => request.id !== requestId)
            }))
          )
          if (selectedRequestId === requestId) setSelectedExampleId(null)
          setSelectedRequestId((current) => (current === requestId ? null : current))
          setConfirm(null)
        }
      })
    },
    [collections, selectedRequestId, setCollections]
  )

  const handleDeleteCollection = useCallback(
    (collectionId: string) => {
      const target = collections.find((collection) => collection.id === collectionId)
      if (!target) return
      setConfirm({
        title: 'Delete Collection?',
        message: `Are you sure you want to delete "${target.name}"? All requests inside will be removed.`,
        confirmLabel: 'Delete',
        onConfirm: () => {
          const requestIds = new Set(target.requests.map((request) => request.id))
          setCollections((prev) => prev.filter((collection) => collection.id !== collectionId))
          if (selectedRequestId && requestIds.has(selectedRequestId)) setSelectedExampleId(null)
          setSelectedCollectionId((current) => (current === collectionId ? null : current))
          setSelectedRequestId((current) => (current && requestIds.has(current) ? null : current))
          setConfirm(null)
        }
      })
    },
    [collections, selectedRequestId, setCollections]
  )

  const closeCollection = useCallback((collectionId: string) => {
    setExpanded((prev) => ({ ...prev, [collectionId]: false }))
    setSelectedCollectionId((current) => (current === collectionId ? null : current))
  }, [])

  const handleClearCollection = useCallback(
    (collectionId: string) => {
      const target = collections.find((collection) => collection.id === collectionId)
      if (!target) return

      if (target.requests.length === 0) {
        closeCollection(collectionId)
        return
      }

      const requestIds = new Set(target.requests.map((request) => request.id))
      setConfirm({
        title: 'Close & Clear Collection?',
        message: `Remove all ${target.requests.length} request(s) from "${target.name}" and close it? The collection will stay in the sidebar.`,
        confirmLabel: 'Close & Clear',
        onConfirm: () => {
          setCollections((prev) =>
            prev.map((collection) =>
              collection.id === collectionId ? { ...collection, requests: [] } : collection
            )
          )
          setResponses((prev) => {
            const next = { ...prev }
            requestIds.forEach((requestId) => delete next[requestId])
            return next
          })
          setErrors((prev) => {
            const next = { ...prev }
            requestIds.forEach((requestId) => delete next[requestId])
            return next
          })
          if (selectedRequestId && requestIds.has(selectedRequestId)) setSelectedExampleId(null)
          setSelectedRequestId((current) => (current && requestIds.has(current) ? null : current))
          closeCollection(collectionId)
          setConfirm(null)
        }
      })
    },
    [closeCollection, collections, selectedRequestId, setCollections]
  )

  const openCollectionMenu = useCallback(
    (collectionId: string, event: ReactMouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setSelectedCollectionId(collectionId)
      setSelectedExampleId(null)
      setMenu({
        x: event.clientX,
        y: event.clientY,
        items: [
          { label: 'New Request', onSelect: () => handleNewRequest(collectionId) },
          { label: 'Rename', onSelect: () => setRenaming({ type: 'collection', id: collectionId }) },
          { label: 'Close & Clear', danger: true, onSelect: () => handleClearCollection(collectionId) },
          { label: 'Delete', danger: true, onSelect: () => handleDeleteCollection(collectionId) }
        ]
      })
    },
    [handleClearCollection, handleDeleteCollection, handleNewRequest]
  )

  const openRequestMenu = useCallback(
    (requestId: string, event: ReactMouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setSelectedRequestId(requestId)
      setSelectedExampleId(null)
      setMenu({
        x: event.clientX,
        y: event.clientY,
        items: [
          { label: 'Rename', onSelect: () => setRenaming({ type: 'request', id: requestId }) },
          { label: 'Duplicate', onSelect: () => handleDuplicateRequest(requestId) },
          { label: 'Delete', danger: true, onSelect: () => handleDeleteRequest(requestId) }
        ]
      })
    },
    [handleDeleteRequest, handleDuplicateRequest]
  )

  const openBlankMenu = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault()
      setMenu({
        x: event.clientX,
        y: event.clientY,
        items: [{ label: 'New Collection', onSelect: handleNewCollection }]
      })
    },
    [handleNewCollection]
  )

  const handleSetVariableValue = useCallback(
    (variableId: string, value: string) => {
      if (!activeEnvironmentId) return
      setEnvironments((prev) =>
        prev.map((environment) =>
          environment.id === activeEnvironmentId
            ? {
                ...environment,
                variables: environment.variables.map((variable) =>
                  variable.id === variableId ? { ...variable, value } : variable
                )
              }
            : environment
        )
      )
    },
    [activeEnvironmentId, setEnvironments]
  )

  const handleCreateVariable = useCallback(
    (value: string) => {
      if (!activeEnvironmentId) {
        setAlert({
          title: 'No active environment',
          message: 'Pilih atau buat environment terlebih dahulu untuk menyimpan variable.'
        })
        return
      }
      setPrompt({
        title: 'Create New Variable',
        message: 'Masukkan nama variable. Nilainya akan diisi dari teks yang kamu pilih.',
        defaultValue: '',
        onSubmit: (name) => {
          setEnvironments((prev) =>
            prev.map((environment) =>
              environment.id === activeEnvironmentId
                ? {
                    ...environment,
                    variables: [
                      ...environment.variables,
                      { id: uid('env'), key: name, value, description: '', enabled: true }
                    ]
                  }
                : environment
            )
          )
          setPrompt(null)
        }
      })
    },
    [activeEnvironmentId, setEnvironments]
  )

  const openResponseVariableMenu = useCallback(
    (event: ReactMouseEvent, text: string) => {
      const environment = environments.find((item) => item.id === activeEnvironmentId) ?? null
      const submenu: ContextMenuItem[] = []

      if (environment && environment.variables.length > 0) {
        environment.variables.forEach((variable) => {
          submenu.push({
            label: variable.key || '(unnamed)',
            onSelect: () => handleSetVariableValue(variable.id, text)
          })
        })
      } else {
        submenu.push({ label: 'No variables in environment', disabled: true })
      }
      submenu.push({ label: 'Create New Variable…', onSelect: () => handleCreateVariable(text) })

      setMenu({
        x: event.clientX,
        y: event.clientY,
        items: [{ label: 'Add to Variable', submenu }]
      })
    },
    [environments, activeEnvironmentId, handleSetVariableValue, handleCreateVariable]
  )

  const applySnapshot = useCallback(
    (snapshot: WorkspaceSnapshot) => {
      setCollections(snapshot.collections)
      setEnvironments((prev) => applyLocalSecrets(snapshot.environments, prev))
      setSelectedExampleId(null)
      const first = snapshot.collections[0]
      if (first) {
        setSelectedCollectionId(first.id)
        setSelectedRequestId(first.requests[0]?.id ?? null)
      }
    },
    [setCollections, setEnvironments]
  )

  const pushHistory = useCallback((entry: HistoryEntry) => {
    setHistoryEntries((prev) => {
      const next = [entry, ...prev].slice(0, 50)
      void saveHistory(next)
      return next
    })
  }, [])

  const handleSyncSubmit = useCallback(
    async (values: { url: string; password: string; author: string; message: string }): Promise<string | null> => {
      const connection = { url: values.url, password: values.password, author: values.author }
      setSync(connection)

      if (syncMode === 'upload') {
        const snapshot: WorkspaceSnapshot = {
          collections,
          environments: sanitizeEnvironments(environments)
        }
        const result = await syncUpload(connection, values.message, snapshot)
        if (!result.ok) return result.error
        pushHistory({
          id: uid('h'),
          message: values.message,
          author: values.author || 'unknown',
          createdAt: new Date().toISOString(),
          snapshot
        })
        setSyncMode(null)
        return null
      }

      const result = await syncPull(connection)
      if (!result.ok) return result.error
      applySnapshot(result.snapshot)
      pushHistory({
        id: uid('h'),
        message: `Import from ${values.url} (updated ${new Date(result.updatedAt).toLocaleString()})`,
        author: result.author,
        createdAt: new Date().toISOString(),
        snapshot: result.snapshot
      })
      setSyncMode(null)
      return null
    },
    [syncMode, collections, environments, setSync, pushHistory, applySnapshot]
  )

  const handleSyncTest = useCallback(async (values: { url: string; password: string }) => {
    const result = await syncTest(values)
    return result.ok ? { ok: true, message: '' } : { ok: false, message: result.error }
  }, [])

  const handleRollback = useCallback(
    (entry: HistoryEntry) => {
      applySnapshot(entry.snapshot)
      setHistoryOpen(false)
    },
    [applySnapshot]
  )

  const handleDeleteHistory = useCallback((id: string) => {
    setHistoryEntries((prev) => {
      const next = prev.filter((entry) => entry.id !== id)
      void saveHistory(next)
      return next
    })
  }, [])

  const startResize = useCallback((event: ReactMouseEvent) => {
    event.preventDefault()
    const container = splitRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()

    const onMove = (moveEvent: MouseEvent) => {
      const pct = ((rect.bottom - moveEvent.clientY) / rect.height) * 100
      setResponsePct(Math.min(85, Math.max(15, pct)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const applyWorkspaceImport = useCallback(
    (result: WorkspaceMergeResult, mode: WorkspaceImportMode) => {
      setSelectedExampleId(null)
      setCollections(result.collections)
      setEnvironments(result.environments)

      const changed = [...result.replacedCollections, ...result.addedCollections]
      setExpanded((prev) => {
        const next = { ...prev }
        changed.forEach((collection) => {
          next[collection.id] = true
          collection.requests.forEach((request) => {
            const segments = request.group ?? []
            let path = ''
            segments.forEach((segment) => {
              path = path ? `${path}/${segment}` : segment
              next[`${collection.id}::${path}`] = true
            })
          })
        })
        return next
      })

      const first =
        mode === 'replace'
          ? result.replacedCollections[0] ?? result.addedCollections[0]
          : result.addedCollections[0]
      if (first) {
        setSelectedCollectionId(first.id)
        setSelectedRequestId(first.requests[0]?.id ?? null)
      }
    },
    [setCollections, setEnvironments]
  )

  const handleImportFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return

      try {
        const text = await file.text()
        const workspace = parseWorkspaceExport(text)

        if (workspace) {
          const merge = mergeImportedWorkspace(collections, environments, workspace, 'merge')
          const replace = mergeImportedWorkspace(collections, environments, workspace, 'replace')

          if (
            merge.addedCollections.length === 0 &&
            merge.addedEnvironments.length === 0 &&
            replace.replacedCollections.length === 0
          ) {
            setAlert({
              title: 'Nothing to import',
              message: `Tidak ada collection baru atau environment baru di "${workspace.workspaceName}".`
            })
            return
          }

          setWorkspaceImport({ workspace, merge, replace })
          return
        }

        const imported = parseOpenApiCollections(text)
        if (imported.length === 0) return
        setSelectedExampleId(null)
        setCollections((prev) => [...prev, ...imported])
        setExpanded((prev) => {
          const next = { ...prev }
          imported.forEach((collection) => {
            next[collection.id] = true
          })
          return next
        })
        const first = imported[0]
        setSelectedCollectionId(first.id)
        setSelectedRequestId(first.requests[0]?.id ?? null)
      } catch (error) {
        setAlert({ title: 'Import failed', message: (error as Error).message })
      }
    },
    [collections, environments, setCollections, setEnvironments]
  )

  const handleSend = useCallback(async () => {
    if (!active || loadingId) return
    setSelectedExampleId(null)
    const request = active.request
    const requestId = request.id

    const variables = buildVariableMap(activeEnvironment)
    const resolvedUrl = resolveUrl(request.url, variables)

    // Mock mode never touches the network, so skip URL/body validation.
    if (request.mock) {
      setLoadingId(requestId)
      setErrors((prev) => ({ ...prev, [requestId]: null }))
      try {
        const response = await sendMockRequest(request, resolvedUrl)
        setResponses((prev) => ({ ...prev, [requestId]: response }))
      } catch (error) {
        setErrors((prev) => ({
          ...prev,
          [requestId]: { kind: 'unknown', message: 'Mock Failed', detail: (error as Error).message }
        }))
      } finally {
        setLoadingId(null)
      }
      return
    }

    if (!isHttpUrl(resolvedUrl)) {
      setErrors((prev) => ({ ...prev, [requestId]: { kind: 'invalid-url', message: 'Invalid URL.' } }))
      return
    }

    const resolvedBody = { ...request.body, content: interpolate(request.body.content, variables) }
    const jsonError = validateJsonBody(resolvedBody)
    if (jsonError) {
      setErrors((prev) => ({
        ...prev,
        [requestId]: { kind: 'invalid-json', message: 'Invalid JSON body.', detail: jsonError }
      }))
      return
    }

    if (!window.api?.sendRequest) {
      setErrors((prev) => ({
        ...prev,
        [requestId]: { kind: 'unknown', message: 'Request Failed', detail: 'Electron bridge unavailable.' }
      }))
      return
    }

    const resolvedParams = request.params.map((param) => ({
      ...param,
      key: interpolate(param.key, variables),
      value: interpolate(param.value, variables)
    }))
    const resolvedHeaders = request.headers.map((header) => ({
      ...header,
      key: interpolate(header.key, variables),
      value: interpolate(header.value, variables)
    }))
    const resolvedAuth = {
      ...request.auth,
      token: interpolate(request.auth.token, variables),
      username: interpolate(request.auth.username, variables),
      password: interpolate(request.auth.password, variables),
      apiKeyName: interpolate(request.auth.apiKeyName, variables),
      apiKeyValue: interpolate(request.auth.apiKeyValue, variables)
    }

    const payload = {
      method: request.method,
      url: buildFinalUrl(resolvedUrl, resolvedParams),
      headers: buildHeaders(resolvedHeaders, resolvedAuth, resolvedBody, encodeBase64),
      body: resolvedBody.format === 'none' ? undefined : resolvedBody.content,
      timeoutMs: 30000
    }

    setLoadingId(requestId)
    setErrors((prev) => ({ ...prev, [requestId]: null }))

    try {
      const result = await window.api.sendRequest(payload)
      if (result.ok) {
        setResponses((prev) => ({ ...prev, [requestId]: result.response }))
      } else {
        setErrors((prev) => ({ ...prev, [requestId]: result.error }))
      }
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        [requestId]: { kind: 'unknown', message: 'Request Failed', detail: (error as Error).message }
      }))
    } finally {
      setLoadingId(null)
    }
  }, [active, activeEnvironment, loadingId])

  const openExampleDialog = useCallback(() => {
    if (!active) return
    const response = responses[active.request.id]
    if (!response) return

    const baseName = `${active.request.name} — ${response.status} ${response.statusText}`.trim()
    let name = baseName
    let index = 2
    const examples = active.request.examples ?? []
    while (examples.some((example) => example.name === name)) {
      name = `${baseName} (${index})`
      index += 1
    }

    setExampleDialog({
      requestId: active.request.id,
      collectionId: active.collection.id,
      defaultName: name,
      response
    })
  }, [active, responses])

  const handleCreateExample = useCallback(
    (values: { name: string; status: number; statusText: string }) => {
      if (!exampleDialog) return
      const { requestId, collectionId, response } = exampleDialog
      const found = findRequest(collections, requestId)
      if (!found) {
        setExampleDialog(null)
        return
      }

      const request = found.request
      const example: RequestExample = {
        id: uid('ex'),
        name: values.name,
        status: values.status,
        statusText: values.statusText || statusTextFor(values.status),
        headers: response.headers.map((header) => ({ ...header })),
        body: response.body,
        createdAt: new Date().toISOString(),
        request: {
          method: request.method,
          url: request.url,
          params: request.params.map((param) => ({ ...param, id: uid('kv') })),
          headers: request.headers.map((header) => ({ ...header, id: uid('kv') })),
          auth: { ...request.auth },
          body: { format: request.body.format, content: request.body.content }
        }
      }

      setCollections((prev) =>
        prev.map((collection) =>
          collection.id === collectionId
            ? {
                ...collection,
                requests: collection.requests.map((item) =>
                  item.id === requestId
                    ? { ...item, examples: [...(item.examples ?? []), example] }
                    : item
                )
              }
            : collection
        )
      )
      setExpanded((prev) => ({
        ...prev,
        [collectionId]: true,
        [`ex:${requestId}`]: true
      }))
      setSelectedCollectionId(collectionId)
      setSelectedRequestId(requestId)
      setSelectedExampleId(example.id)
      setExampleDialog(null)
    },
    [collections, exampleDialog, setCollections]
  )

  const handleDeleteExample = useCallback(
    (exampleId: string, requestId: string) => {
      const found = findRequest(collections, requestId)
      const example = found?.request.examples?.find((item) => item.id === exampleId)
      if (!found || !example) return

      setConfirm({
        title: 'Delete Example?',
        message: `Delete example "${example.name}"? The request itself is not affected.`,
        confirmLabel: 'Delete',
        onConfirm: () => {
          setCollections((prev) =>
            prev.map((collection) => ({
              ...collection,
              requests: collection.requests.map((request) =>
                request.id === requestId
                  ? {
                      ...request,
                      examples: (request.examples ?? []).filter((item) => item.id !== exampleId)
                    }
                  : request
              )
            }))
          )
          setSelectedExampleId((current) => (current === exampleId ? null : current))
          setConfirm(null)
        }
      })
    },
    [collections, setCollections]
  )

  const openExampleMenu = useCallback(
    (exampleId: string, requestId: string, event: ReactMouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      const found = findRequest(collections, requestId)
      const example = found?.request.examples?.find((item) => item.id === exampleId)
      if (!found || !example) return

      setSelectedCollectionId(found.collection.id)
      setSelectedRequestId(requestId)
      setSelectedExampleId(exampleId)
      setMenu({
        x: event.clientX,
        y: event.clientY,
        items: [
          {
            label: 'Delete Example',
            danger: true,
            onSelect: () => handleDeleteExample(exampleId, requestId)
          }
        ]
      })
    },
    [collections, handleDeleteExample]
  )

  const breadcrumb = active
    ? `${active.collection.name} / ${active.request.name}${activeExample ? ` / ${activeExample.name}` : ''}`
    : 'No request selected'

  return (
    <div className="flex h-screen flex-col bg-studio-bg text-studio-text">
      <TopBar
        search={search}
        onSearchChange={setSearch}
        breadcrumb={breadcrumb}
        workspace={workspace}
        onWorkspaceChange={setWorkspace}
        environments={environments}
        activeEnvironmentId={activeEnvironmentId}
        onSelectEnvironment={setActiveEnvironmentId}
        onManageEnvironments={() => setEnvModalOpen(true)}
        onUpload={() => setSyncMode('upload')}
        onImport={() => setSyncMode('import')}
        onHistory={() => setHistoryOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          collections={collections}
          expanded={expanded}
          onToggle={toggleCollection}
          selectedCollectionId={selectedCollectionId}
          selectedRequestId={selectedRequestId}
          selectedExampleId={selectedExampleId}
          onSelectCollection={handleSelectCollection}
          onSelectRequest={handleSelectRequest}
          onSelectExample={handleSelectExample}
          search={search}
          onSearchChange={setSearch}
          renaming={renaming}
          onCollectionContextMenu={openCollectionMenu}
          onRequestContextMenu={openRequestMenu}
          onExampleContextMenu={openExampleMenu}
          onRenameCollection={handleRenameCollection}
          onRenameRequest={handleRenameRequest}
          onCancelRename={() => setRenaming(null)}
          onNewCollection={handleNewCollection}
          onNewRequest={handleNewRequest}
          onImport={() => fileInputRef.current?.click()}
          onBlankContextMenu={openBlankMenu}
        />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {active ? (
            <div ref={splitRef} className="flex min-h-0 flex-1 flex-col">
              <RequestEditor
                key={active.request.id}
                request={active.request}
                onChange={updateActiveRequest}
                onSend={handleSend}
                sending={loadingId === active.request.id}
                environmentVariables={activeEnvironment?.variables ?? []}
              />
              <div
                onMouseDown={startResize}
                onDoubleClick={() => setResponsePct(42)}
                title="Drag to resize response"
                className="group flex h-1.5 shrink-0 cursor-row-resize select-none items-center justify-center bg-studio-panel hover:bg-studio-accent/15"
              >
                <div className="h-0.5 w-10 rounded-full bg-studio-strong transition-colors group-hover:bg-studio-accent" />
              </div>
              <ResponseViewer
                response={activeExample ? exampleResponse : responses[active.request.id] ?? null}
                error={activeExample ? null : errors[active.request.id] ?? null}
                loading={activeExample ? false : loadingId === active.request.id}
                heightPct={responsePct}
                onContextMenuSelection={openResponseVariableMenu}
                onSaveExample={openExampleDialog}
                exampleMeta={
                  activeExample ? { name: activeExample.name, request: activeExample.request } : null
                }
                onCloseExample={() => setSelectedExampleId(null)}
              />
            </div>
          ) : (
            <EmptyState onCreate={() => handleNewRequest(selectedCollectionId ?? collections[0]?.id ?? '')} />
          )}
        </main>
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={() => setMenu(null)} />}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {alert && (
        <ConfirmDialog
          title={alert.title}
          message={alert.message}
          confirmLabel="OK"
          variant="info"
          hideCancel
          onConfirm={() => setAlert(null)}
          onCancel={() => setAlert(null)}
        />
      )}

      {exampleDialog && (
        <ExampleDialog
          defaultName={exampleDialog.defaultName}
          defaultStatus={exampleDialog.response.status}
          defaultStatusText={exampleDialog.response.statusText}
          onSave={handleCreateExample}
          onCancel={() => setExampleDialog(null)}
        />
      )}

      {workspaceImport && (
        <WorkspaceImportDialog
          workspaceName={workspaceImport.workspace.workspaceName}
          newCollections={workspaceImport.merge.addedCollections.map((collection) => collection.name)}
          existingCollections={workspaceImport.merge.skippedCollections}
          newEnvironments={workspaceImport.merge.addedEnvironments.map((environment) => environment.name)}
          onImport={(mode) => {
            const result = mode === 'replace' ? workspaceImport.replace : workspaceImport.merge
            applyWorkspaceImport(result, mode)
            setWorkspaceImport(null)
          }}
          onCancel={() => setWorkspaceImport(null)}
        />
      )}

      {envModalOpen && (
        <EnvironmentsModal
          environments={environments}
          activeEnvironmentId={activeEnvironmentId}
          onChange={setEnvironments}
          onSelectActive={(id) => setActiveEnvironmentId(id || null)}
          onClose={() => setEnvModalOpen(false)}
        />
      )}

      {prompt && (
        <PromptDialog
          title={prompt.title}
          message={prompt.message}
          defaultValue={prompt.defaultValue}
          onConfirm={prompt.onSubmit}
          onCancel={() => setPrompt(null)}
        />
      )}

      {syncMode && (
        <SyncDialog
          mode={syncMode}
          initial={sync}
          onCancel={() => setSyncMode(null)}
          onSubmit={handleSyncSubmit}
          onTest={handleSyncTest}
          onClear={() => setSync(null)}
        />
      )}

      {historyOpen && (
        <HistoryDialog
          entries={historyEntries}
          onRollback={handleRollback}
          onDelete={handleDeleteHistory}
          onCancel={() => setHistoryOpen(false)}
        />
      )}
    </div>
  )
}
