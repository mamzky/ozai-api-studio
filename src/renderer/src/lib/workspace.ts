import type {
  ApiRequest,
  AuthConfig,
  AuthType,
  BodyConfig,
  BodyFormat,
  Collection,
  Environment,
  HttpMethod,
  KeyValue,
  MockResponse
} from '../types/api'
import { uid } from './format'

type Json = Record<string, unknown>

export interface ImportedWorkspace {
  collections: Collection[]
  environments: Environment[]
  activeEnvironmentId: string | null
  workspaceName: string
}

export interface WorkspaceMergeResult {
  collections: Collection[]
  environments: Environment[]
  addedCollections: Collection[]
  replacedCollections: Collection[]
  addedEnvironments: Environment[]
  skippedCollections: string[]
}

export type WorkspaceImportMode = 'merge' | 'replace'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const AUTH_TYPES: AuthType[] = ['none', 'bearer', 'basic', 'api-key']
const BODY_FORMATS: BodyFormat[] = ['none', 'json', 'raw']

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asString = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value))

const emptyAuth = (): AuthConfig => ({
  type: 'none',
  token: '',
  username: '',
  password: '',
  apiKeyName: '',
  apiKeyValue: ''
})

const normalizeKeyValues = (value: unknown): KeyValue[] => {
  if (!Array.isArray(value)) return []
  return value.filter(isObject).map((row) => ({
    id: uid('kv'),
    key: asString(row.key),
    value: asString(row.value),
    description: asString(row.description),
    enabled: row.enabled !== false
  }))
}

const normalizeAuth = (value: unknown): AuthConfig => {
  if (!isObject(value)) return emptyAuth()
  const type = asString(value.type) as AuthType
  return {
    type: AUTH_TYPES.includes(type) ? type : 'none',
    token: asString(value.token),
    username: asString(value.username),
    password: asString(value.password),
    apiKeyName: asString(value.apiKeyName),
    apiKeyValue: asString(value.apiKeyValue)
  }
}

const normalizeBody = (value: unknown): BodyConfig => {
  if (!isObject(value)) return { format: 'none', content: '' }
  const format = asString(value.format) as BodyFormat
  return {
    format: BODY_FORMATS.includes(format) ? format : 'none',
    content: asString(value.content)
  }
}

const normalizeMock = (value: unknown): MockResponse | undefined => {
  if (!isObject(value)) return undefined
  const status = typeof value.status === 'number' ? value.status : Number(value.status)
  if (!Number.isFinite(status)) return undefined
  const headers = Array.isArray(value.headers)
    ? value.headers.filter(isObject).map((header) => ({
        key: asString(header.key),
        value: asString(header.value)
      }))
    : []
  return {
    status,
    statusText: asString(value.statusText),
    headers,
    body: asString(value.body)
  }
}

const normalizeRequest = (value: unknown): ApiRequest | null => {
  if (!isObject(value)) return null
  const method = asString(value.method).toUpperCase() as HttpMethod
  const url = asString(value.url)
  const name = asString(value.name) || `${method || 'GET'} ${url}`
  const group = Array.isArray(value.group) ? value.group.map(asString).filter(Boolean) : undefined
  const mockResponse = normalizeMock(value.mockResponse)

  return {
    id: uid('req'),
    name,
    method: METHODS.includes(method) ? method : 'GET',
    url,
    params: normalizeKeyValues(value.params),
    headers: normalizeKeyValues(value.headers),
    auth: normalizeAuth(value.auth),
    body: normalizeBody(value.body),
    mock: value.mock === true || (!('mock' in value) && Boolean(mockResponse)),
    ...(mockResponse ? { mockResponse } : {}),
    ...(group && group.length > 0 ? { group } : {})
  }
}

const normalizeCollection = (value: unknown): Collection | null => {
  if (!isObject(value)) return null
  const name = asString(value.name).trim()
  if (!name) return null
  const requests = Array.isArray(value.requests)
    ? value.requests.map(normalizeRequest).filter((request): request is ApiRequest => request !== null)
    : []
  return { id: uid('col'), name, requests }
}

const normalizeEnvironment = (value: unknown): Environment | null => {
  if (!isObject(value)) return null
  const name = asString(value.name).trim()
  if (!name) return null
  return {
    id: uid('env'),
    name,
    variables: normalizeKeyValues(value.variables)
  }
}

/** Parses an Ozai workspace export (web app or a desktop AppData-shaped backup). */
export function parseWorkspaceExport(text: string): ImportedWorkspace | null {
  let root: unknown
  try {
    root = JSON.parse(text) as unknown
  } catch {
    return null
  }
  if (!isObject(root)) return null

  const workspace = isObject(root.workspace) ? root.workspace : root
  if (!Array.isArray(workspace.collections)) return null

  const collections = workspace.collections
    .map(normalizeCollection)
    .filter((collection): collection is Collection => collection !== null)
  if (collections.length === 0) return null

  const environments = Array.isArray(workspace.environments)
    ? workspace.environments
        .map(normalizeEnvironment)
        .filter((environment): environment is Environment => environment !== null)
    : []

  return {
    collections,
    environments,
    activeEnvironmentId: asString(workspace.activeEnvironmentId) || null,
    workspaceName: asString(workspace.workspaceName) || 'Imported Workspace'
  }
}

/**
 * Appends collections/environments that do not already exist (matched by name).
 * With `replace`, collections with the same name are refreshed from the import
 * while keeping their existing collection ID; other collections are untouched.
 */
export function mergeImportedWorkspace(
  currentCollections: Collection[],
  currentEnvironments: Environment[],
  imported: ImportedWorkspace,
  mode: WorkspaceImportMode = 'merge'
): WorkspaceMergeResult {
  const existingCollections = new Set(
    currentCollections.map((collection) => collection.name.trim().toLowerCase())
  )
  const existingEnvironments = new Set(
    currentEnvironments.map((environment) => environment.name.trim().toLowerCase())
  )

  const addedCollections: Collection[] = []
  const replacedCollections: Collection[] = []
  const skippedCollections: string[] = []

  let collections: Collection[]

  if (mode === 'replace') {
    const incoming = new Map(
      imported.collections.map((collection) => [collection.name.trim().toLowerCase(), collection])
    )

    collections = currentCollections.map((collection) => {
      const key = collection.name.trim().toLowerCase()
      const replacement = incoming.get(key)
      if (!replacement) return collection

      incoming.delete(key)
      const updated: Collection = { ...collection, requests: replacement.requests }
      replacedCollections.push(updated)
      return updated
    })

    incoming.forEach((collection) => {
      if (existingCollections.has(collection.name.trim().toLowerCase())) return
      addedCollections.push(collection)
    })
  } else {
    imported.collections.forEach((collection) => {
      const key = collection.name.trim().toLowerCase()
      if (existingCollections.has(key)) {
        skippedCollections.push(collection.name)
        return
      }
      existingCollections.add(key)
      addedCollections.push(collection)
    })
    collections = [...currentCollections, ...addedCollections]
  }

  const addedEnvironments = imported.environments.filter((environment) => {
    const key = environment.name.trim().toLowerCase()
    if (existingEnvironments.has(key)) return false
    existingEnvironments.add(key)
    return true
  })

  return {
    collections,
    environments: [...currentEnvironments, ...addedEnvironments],
    addedCollections,
    replacedCollections,
    addedEnvironments,
    skippedCollections
  }
}
