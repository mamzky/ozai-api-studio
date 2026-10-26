export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface KeyValue {
  id: string
  key: string
  value: string
  description: string
  enabled: boolean
  secret?: boolean
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key'

export interface AuthConfig {
  type: AuthType
  token: string
  username: string
  password: string
  apiKeyName: string
  apiKeyValue: string
}

export type BodyFormat = 'none' | 'json' | 'raw'

export interface BodyConfig {
  format: BodyFormat
  content: string
}

export interface RequestSnapshot {
  method: HttpMethod
  url: string
  params: KeyValue[]
  headers: KeyValue[]
  auth: AuthConfig
  body: BodyConfig
}

export interface RequestExample {
  id: string
  name: string
  status: number
  statusText: string
  headers: ResponseHeader[]
  body: string
  createdAt: string
  /** Request as it looked when the example was saved. */
  request: RequestSnapshot
}

export interface ApiRequest {
  id: string
  name: string
  method: HttpMethod
  url: string
  params: KeyValue[]
  headers: KeyValue[]
  auth: AuthConfig
  body: BodyConfig
  group?: string[]
  /** When true, Send returns `mockResponse` (or a generated fallback) without hitting the network. */
  mock: boolean
  /** Example response captured from an OpenAPI contract. */
  mockResponse?: MockResponse
  /** Saved response examples for documentation (shown under the request in the tree). */
  examples?: RequestExample[]
}

export interface Collection {
  id: string
  name: string
  requests: ApiRequest[]
}

export interface ResponseHeader {
  key: string
  value: string
}

export interface MockResponse {
  status: number
  statusText: string
  headers: ResponseHeader[]
  body: string
}

export interface ApiResponse {
  status: number
  statusText: string
  headers: ResponseHeader[]
  body: string
  timeMs: number
  sizeKb: number
  /** True when the response came from the built-in mock instead of the network. */
  mocked?: boolean
  /** True when this response is a saved example being previewed. */
  example?: boolean
}

export type RequestErrorKind = 'invalid-url' | 'network' | 'timeout' | 'invalid-json' | 'unknown'

export interface RequestError {
  kind: RequestErrorKind
  message: string
  detail?: string
}

export interface HttpRequestPayload {
  method: HttpMethod
  url: string
  headers: Record<string, string>
  body?: string
  timeoutMs?: number
}

export type SendResult =
  | { ok: true; response: ApiResponse }
  | { ok: false; error: RequestError }

export type EnvVariable = KeyValue

export interface Environment {
  id: string
  name: string
  variables: EnvVariable[]
}

export interface AppData {
  collections: Collection[]
  environments: Environment[]
  activeEnvironmentId: string | null
  sync?: SyncConnection
}

export interface WorkspaceSnapshot {
  collections: Collection[]
  environments: Environment[]
}

export interface SyncConnection {
  url: string
  password: string
  author: string
  /** Slug project yang dipakai sebagai kunci baris di `studio_workspace`. */
  project: string
}

export interface HistoryEntry {
  id: string
  message: string
  author: string
  createdAt: string
  snapshot: WorkspaceSnapshot
  /** Project asal snapshot ini, kalau entry dibuat lewat sync. */
  project?: string
}

export interface RemoteCommit {
  id: number
  message: string
  author: string
  createdAt: string
}

export interface SyncError {
  ok: false
  error: string
  code?: 'offline' | 'auth' | 'invalid' | 'unknown'
}

export type SyncUploadResult = { ok: true; commitId: number } | SyncError

export type SyncPullResult =
  | { ok: true; snapshot: WorkspaceSnapshot; updatedAt: string; author: string }
  | SyncError

export type SyncCommitsResult = { ok: true; commits: RemoteCommit[] } | SyncError
