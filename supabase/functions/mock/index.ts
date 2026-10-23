import { createClient } from 'npm:@supabase/supabase-js@2'

const WORKSPACE_ID = 'default'
const FUNCTION_PREFIX = '/functions/v1/mock'
const CACHE_MS = 5_000

type Header = { key?: string; value?: string }

type SnapshotExample = {
  name?: string
  status?: number | string
  statusText?: string
  headers?: Header[]
  body?: string
  createdAt?: string
  request?: { method?: string; url?: string }
}

type SnapshotMock = {
  status?: number | string
  statusText?: string
  headers?: Header[]
  body?: string
}

type SnapshotRequest = {
  name?: string
  method?: string
  url?: string
  examples?: SnapshotExample[]
  mockResponse?: SnapshotMock
}

type SnapshotCollection = {
  name?: string
  requests?: SnapshotRequest[]
}

type Snapshot = {
  collections?: SnapshotCollection[]
}

type WorkspaceRow = {
  data?: Snapshot
  updated_at?: string
  author?: string
}

type ExampleEntry = {
  name: string
  status: number
  statusText: string
  headers: Header[]
  body: string
  createdAt: string
  method: string
  path: string
  pattern: string
  collection: string
  request: string
  source: 'example' | 'mock'
}

type Route = {
  method: string
  pattern: string
  examples: ExampleEntry[]
  collection: string
  request: string
}

type RouteMaps = {
  exact: Map<string, Route>
  patterns: Map<string, Route>
}

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
  408: 'Request Timeout',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout'
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers':
    'x-ozai-mock,x-ozai-example,x-ozai-route,x-ozai-workspace-updated',
  'Access-Control-Max-Age': '86400'
}

const SKIP_RESPONSE_HEADERS = new Set([
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'upgrade'
])

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const supabase =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null

let workspaceCache: { at: number; row: WorkspaceRow | null } | null = null

function jsonResponse(
  data: unknown,
  status = 200,
  extra: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...CORS_HEADERS,
      'content-type': 'application/json; charset=utf-8',
      'x-ozai-mock': 'true',
      ...extra
    }
  })
}

/** Header values must be valid ByteStrings (no em dashes/emoji/newlines). */
function safeHeaderValue(value: unknown): string {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\x00-\xFF]/g, '?')
}

const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

function normalizePath(value: string): string {
  let path = (value || '/').replace(/\/+/g, '/')
  if (!path.startsWith('/')) path = `/${path}`
  if (path.length > 1) path = path.replace(/\/+$/, '')
  return path || '/'
}

function pathFromUrl(raw: string): string {
  const value = (raw || '').trim()
  if (!value) return '/'

  try {
    return normalizePath(new URL(value).pathname)
  } catch {
    // Keep working with `{{base_url}}/path`, `<<base_url>>/path`, or host/path.
  }

  let path = value.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '')
  path = path.replace(/^\{\{[^}]+\}\}/, '').replace(/^<<[^>]+>>/, '')
  path = path.split(/[?#]/)[0]
  if (!path.startsWith('/')) {
    const slash = path.indexOf('/')
    path = slash >= 0 ? path.slice(slash) : `/${path}`
  }
  return normalizePath(path)
}

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function patternFor(path: string): string {
  return path
    .split('/')
    .map((segment) => {
      if (!segment) return segment
      if (segment.startsWith(':')) return ':param'
      if (/^\d+$/.test(segment) || UUID_SEGMENT.test(segment)) return ':param'
      if (/^\{\{.+\}\}$/.test(segment) || /^<<.+>>$/.test(segment)) return ':param'
      return segment
    })
    .join('/')
}

function matchPattern(pattern: string, path: string): boolean {
  const patternParts = pattern.split('/')
  const pathParts = path.split('/')
  if (patternParts.length !== pathParts.length) return false
  return patternParts.every(
    (part, index) => part === ':param' || part === '*' || part === pathParts[index]
  )
}

function addRoute(map: Map<string, Route>, entry: ExampleEntry, routePath: string): void {
  const key = `${entry.method} ${routePath}`
  let route = map.get(key)
  if (!route) {
    route = {
      method: entry.method,
      pattern: routePath,
      examples: [],
      collection: entry.collection,
      request: entry.request
    }
    map.set(key, route)
  }
  route.examples.push(entry)
}

function buildRoutes(snapshot: Snapshot | undefined): {
  maps: RouteMaps
  totalExamples: number
} {
  const maps: RouteMaps = { exact: new Map(), patterns: new Map() }
  let totalExamples = 0

  for (const collection of snapshot?.collections ?? []) {
    const collectionName = collection.name || 'Collection'
    for (const request of collection.requests ?? []) {
      const entries: ExampleEntry[] = []
      const requestName = request.name || 'Request'

      for (const example of request.examples ?? []) {
        const statusValue = Number(example.status ?? 200)
        const status = Number.isFinite(statusValue) ? statusValue : 200
        const method = (example.request?.method || request.method || 'GET').toUpperCase()
        const path = pathFromUrl(example.request?.url || request.url || '/')
        entries.push({
          name: example.name?.trim() || `${status} ${STATUS_TEXT[status] ?? ''}`.trim(),
          status,
          statusText: example.statusText || STATUS_TEXT[status] || '',
          headers: example.headers ?? [],
          body: example.body ?? '',
          createdAt: example.createdAt || '',
          method,
          path,
          pattern: patternFor(path),
          collection: collectionName,
          request: requestName,
          source: 'example'
        })
      }

      if (entries.length === 0 && request.mockResponse) {
        const statusValue = Number(request.mockResponse.status ?? 200)
        const status = Number.isFinite(statusValue) ? statusValue : 200
        const method = (request.method || 'GET').toUpperCase()
        const path = pathFromUrl(request.url || '/')
        entries.push({
          name: 'Default response',
          status,
          statusText: request.mockResponse.statusText || STATUS_TEXT[status] || '',
          headers: request.mockResponse.headers ?? [],
          body: request.mockResponse.body ?? '',
          createdAt: '',
          method,
          path,
          pattern: patternFor(path),
          collection: collectionName,
          request: requestName,
          source: 'mock'
        })
      }

      for (const entry of entries) {
        addRoute(maps.exact, entry, entry.path)
        addRoute(maps.patterns, entry, entry.pattern)
        totalExamples += 1
      }
    }
  }

  return { maps, totalExamples }
}

function matchRoute(maps: RouteMaps, method: string, path: string): Route | null {
  const exact = maps.exact.get(`${method} ${path}`)
  if (exact) return exact

  for (const route of maps.patterns.values()) {
    if (route.method !== method) continue
    if (matchPattern(route.pattern, path)) return route
  }

  if (method === 'HEAD') return matchRoute(maps, 'GET', path)
  return null
}

function selectExample(route: Route, selector: string | null): ExampleEntry | null {
  const sorted = [...route.examples].sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  )
  const fallback = sorted.find((item) => item.status >= 200 && item.status < 300) ?? sorted[0]
  if (!selector || selector === 'default' || selector === 'latest') return fallback

  if (/^\d{3}$/.test(selector)) {
    return sorted.find((item) => item.status === Number(selector)) ?? null
  }

  const lower = selector.toLowerCase()
  return (
    sorted.find((item) => item.name.toLowerCase() === lower) ??
    sorted.find((item) => item.name.toLowerCase().includes(lower)) ??
    null
  )
}

function expectedKey(): string | null {
  return Deno.env.get('MOCK_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || null
}

function providedKey(req: Request, url: URL): string | null {
  const header =
    req.headers.get('x-ozai-mock-key') ||
    req.headers.get('apikey') ||
    url.searchParams.get('__mock_key')
  if (header) return header

  const authorization = req.headers.get('authorization')
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim()
  }
  return null
}

async function loadWorkspace(commit: string | null): Promise<WorkspaceRow | null> {
  if (!supabase) {
    throw new Error(
      'Supabase service role is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the Edge Function secrets.'
    )
  }

  if (commit) {
    const commitId = Number(commit)
    if (!Number.isFinite(commitId)) return null
    const { data, error } = await supabase
      .from('studio_commits')
      .select('data,created_at,author')
      .eq('id', commitId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    return {
      data: data.data as Snapshot,
      updated_at: data.created_at as string,
      author: data.author as string
    } as WorkspaceRow
  }

  if (workspaceCache && Date.now() - workspaceCache.at < CACHE_MS) {
    return workspaceCache.row
  }

  const { data, error } = await supabase
    .from('studio_workspace')
    .select('data,updated_at,author')
    .eq('id', WORKSPACE_ID)
    .maybeSingle()
  if (error) throw new Error(error.message)

  const row = (data as WorkspaceRow | null) ?? null
  workspaceCache = { at: Date.now(), row }
  return row
}

function routeSummary(route: Route): Record<string, unknown> {
  const sorted = [...route.examples].sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  )
  const fallback = sorted.find((item) => item.status >= 200 && item.status < 300) ?? sorted[0]
  return {
    method: route.method,
    path: route.pattern,
    collection: route.collection,
    request: route.request,
    examples: sorted.map((example) => ({
      name: example.name,
      status: example.status,
      statusText: example.statusText,
      default: example === fallback,
      createdAt: example.createdAt || null
    }))
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const url = new URL(req.url)
  let path = url.pathname
  // Supabase's gateway may present the function path as `/mock/...` while the
  // public URL is `/functions/v1/mock/...`. Support both shapes.
  const prefixes = [FUNCTION_PREFIX, '/mock']
  for (const prefix of prefixes) {
    if (path === prefix) {
      path = '/'
      break
    }
    if (path.startsWith(`${prefix}/`)) {
      path = path.slice(prefix.length)
      break
    }
  }
  path = normalizePath(path || '/')
  const method = req.method.toUpperCase()

  const key = expectedKey()
  if (key && providedKey(req, url) !== key) {
    return jsonResponse(
      {
        error: 'Unauthorized mock request',
        hint: 'Send the Supabase anon/publishable key in the apikey header (or x-ozai-mock-key).'
      },
      401
    )
  }

  try {
    const commit = url.searchParams.get('__commit')
    const workspace = await loadWorkspace(commit)

    if (!workspace?.data) {
      return jsonResponse(
        {
          error: 'No workspace uploaded yet',
          hint: 'Open Ozai API Studio, configure Supabase sync, then upload the workspace.'
        },
        503
      )
    }

    const { maps, totalExamples } = buildRoutes(workspace.data)
    const routeList = Array.from(maps.patterns.values())

    if (path === '/__ozai/health') {
      return jsonResponse(
        {
          ok: true,
          service: 'ozai-mock',
          workspace: {
            updatedAt: workspace.updated_at || null,
            author: workspace.author || null,
            collections: workspace.data.collections?.length ?? 0,
            routes: routeList.length,
            examples: totalExamples
          },
          auth: key ? 'key-required' : 'public',
          endpoints: {
            routes: `${FUNCTION_PREFIX}/__ozai/routes`,
            mock: `${FUNCTION_PREFIX}/<path>`
          }
        },
        200,
        { 'x-ozai-workspace-updated': workspace.updated_at || '' }
      )
    }

    if (path === '/__ozai/routes') {
      return jsonResponse(
        {
          workspace: {
            updatedAt: workspace.updated_at || null,
            author: workspace.author || null
          },
          routes: routeList
            .sort((a, b) => `${a.pattern} ${a.method}`.localeCompare(`${b.pattern} ${b.method}`))
            .map(routeSummary)
        },
        200,
        { 'x-ozai-workspace-updated': workspace.updated_at || '' }
      )
    }

    const route = matchRoute(maps, method, path)
    if (!route) {
      return jsonResponse(
        {
          error: 'No example matched this request',
          method,
          path,
          hint: 'Open /__ozai/routes to see available routes. Path matching supports :param for numeric/UUID segments.'
        },
        404,
        { 'x-ozai-workspace-updated': workspace.updated_at || '' }
      )
    }

    const selector =
      req.headers.get('x-ozai-example') ||
      req.headers.get('x-ozai-status') ||
      url.searchParams.get('__example') ||
      url.searchParams.get('__status')

    const example = selectExample(route, selector)
    if (!example) {
      return jsonResponse(
        {
          error: `Example not found for ${route.method} ${route.pattern}`,
          selector,
          available: route.examples.map((item) => ({
            name: item.name,
            status: item.status,
            statusText: item.statusText
          }))
        },
        404,
        { 'x-ozai-workspace-updated': workspace.updated_at || '' }
      )
    }

    const responseHeaders = new Headers(CORS_HEADERS)
    for (const header of example.headers) {
      const name = (header.key || '').trim()
      if (!name || !HEADER_NAME.test(name)) continue
      if (SKIP_RESPONSE_HEADERS.has(name.toLowerCase())) continue
      if (name.toLowerCase().startsWith('access-control-')) continue
      responseHeaders.append(name, safeHeaderValue(header.value))
    }
    if (!responseHeaders.has('content-type')) {
      responseHeaders.set('content-type', 'application/json; charset=utf-8')
    }
    responseHeaders.set('x-ozai-mock', 'true')
    responseHeaders.set('x-ozai-example', safeHeaderValue(example.name))
    responseHeaders.set('x-ozai-route', safeHeaderValue(route.pattern))
    responseHeaders.set('x-ozai-workspace-updated', safeHeaderValue(workspace.updated_at || ''))

    const bodyAllowed = method !== 'HEAD' && example.status !== 204 && example.status !== 304
    console.log(
      JSON.stringify({
        mock: true,
        method,
        path,
        route: route.pattern,
        example: example.name,
        status: example.status
      })
    )

    return new Response(bodyAllowed ? example.body : null, {
      status: example.status,
      headers: responseHeaders
    })
  } catch (error) {
    console.error('[ozai-mock]', error)
    return jsonResponse(
      {
        error: 'Mock server failed',
        detail: error instanceof Error ? error.message : String(error)
      },
      500
    )
  }
})
