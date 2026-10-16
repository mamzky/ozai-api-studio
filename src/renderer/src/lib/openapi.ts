import type { ApiRequest, AuthConfig, BodyConfig, Collection, HttpMethod, KeyValue } from '../types/api'
import { uid } from './format'

type Json = Record<string, unknown>

const OPERATION_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const emptyAuth = (): AuthConfig => ({
  type: 'none',
  token: '',
  username: '',
  password: '',
  apiKeyName: '',
  apiKeyValue: ''
})

const makeKv = (key: string, value: string, description = '', enabled = true): KeyValue => ({
  id: uid('kv'),
  key,
  value,
  description,
  enabled
})

const asArray = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : [])

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asString = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value))

const getByPointer = (root: Json, ref: string): unknown => {
  if (!ref.startsWith('#/')) return undefined
  return ref
    .slice(2)
    .split('/')
    .reduce<unknown>((acc, key) => (isObject(acc) ? acc[decodeURIComponent(key)] : undefined), root)
}

const createResolver = (root: Json) => {
  const resolve = (node: unknown, depth = 0): Json | undefined => {
    if (!isObject(node) || depth > 25) return isObject(node) ? node : undefined
    if (typeof node.$ref === 'string') {
      const target = getByPointer(root, node.$ref)
      return isObject(target) ? resolve(target, depth + 1) : undefined
    }
    return node
  }
  return resolve
}

const stringExample = (schema: Json): string => {
  const format = typeof schema.format === 'string' ? schema.format : ''
  switch (format) {
    case 'date-time':
      return '2024-01-01T00:00:00Z'
    case 'date':
      return '2024-01-01'
    case 'email':
      return 'user@example.com'
    case 'uuid':
      return '00000000-0000-0000-0000-000000000000'
    case 'uri':
    case 'url':
      return 'https://example.com'
    case 'password':
      return 'password'
    default:
      return ''
  }
}

const exampleFor = (
  schema: unknown,
  resolve: (node: unknown) => Json | undefined,
  seen: Set<string> = new Set()
): unknown => {
  if (!isObject(schema)) return null

  if (typeof schema.$ref === 'string') {
    if (seen.has(schema.$ref)) return null
    const next = new Set(seen)
    next.add(schema.$ref)
    return exampleFor(resolve(schema), resolve, next)
  }

  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0]

  if (Array.isArray(schema.allOf)) {
    const merged: Json = {}
    for (const sub of schema.allOf) {
      const value = exampleFor(sub, resolve, seen)
      if (isObject(value)) Object.assign(merged, value)
    }
    return merged
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) return exampleFor(schema.oneOf[0], resolve, seen)
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) return exampleFor(schema.anyOf[0], resolve, seen)

  const type =
    typeof schema.type === 'string'
      ? schema.type
      : isObject(schema.properties)
        ? 'object'
        : schema.items
          ? 'array'
          : undefined

  switch (type) {
    case 'object': {
      const result: Json = {}
      const properties = isObject(schema.properties) ? schema.properties : {}
      for (const [key, sub] of Object.entries(properties)) {
        result[key] = exampleFor(sub, resolve, seen)
      }
      return result
    }
    case 'array':
      return [exampleFor(schema.items, resolve, seen)]
    case 'string':
      return stringExample(schema)
    case 'integer':
    case 'number':
      return 0
    case 'boolean':
      return true
    default:
      return null
  }
}

const toParamValue = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const findJsonLike = (content: Json): unknown => {
  const key = Object.keys(content).find((type) => type.includes('json'))
  return key ? content[key] : undefined
}

const authFromSecurity = (
  operation: Json,
  root: Json,
  resolve: (node: unknown) => Json | undefined
): AuthConfig => {
  const security = Array.isArray(operation.security)
    ? operation.security
    : Array.isArray(root.security)
      ? root.security
      : []
  const requirement = security.length > 0 && isObject(security[0]) ? (security[0] as Json) : null
  if (!requirement) return emptyAuth()

  const schemeName = Object.keys(requirement)[0]
  if (!schemeName) return emptyAuth()

  const schemes =
    isObject(root.components) && isObject(root.components.securitySchemes)
      ? (root.components.securitySchemes as Json)
      : {}
  const scheme = resolve(schemes[schemeName]) ?? {}

  if (scheme.type === 'http') {
    if (scheme.scheme === 'basic') return { ...emptyAuth(), type: 'basic' }
    return { ...emptyAuth(), type: 'bearer' }
  }
  if (scheme.type === 'apiKey') {
    return {
      ...emptyAuth(),
      type: 'api-key',
      apiKeyName: typeof scheme.name === 'string' ? scheme.name : 'X-API-Key'
    }
  }
  if (scheme.type === 'oauth2' || scheme.type === 'openIdConnect') {
    return { ...emptyAuth(), type: 'bearer' }
  }
  return emptyAuth()
}

const authFromDropped = (auth: unknown): AuthConfig => {
  if (!isObject(auth)) return emptyAuth()
  const type = auth.authType
  if (type === 'bearer') return { ...emptyAuth(), type: 'bearer', token: asString(auth.token) }
  if (type === 'basic') {
    return {
      ...emptyAuth(),
      type: 'basic',
      username: asString(auth.username),
      password: asString(auth.password)
    }
  }
  if (type === 'api-key') {
    return { ...emptyAuth(), type: 'api-key', apiKeyName: asString(auth.key), apiKeyValue: asString(auth.value) }
  }
  return emptyAuth()
}

const splitTagPath = (tag: string): { collection: string; group: string[] } | null => {
  const segments = tag
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
  if (segments.length === 0) return null
  return { collection: segments[0], group: segments.slice(1) }
}

const buildOperationRequest = (
  method: HttpMethod,
  path: string,
  operation: Json,
  pathLevelParams: unknown[],
  baseUrl: string,
  resolve: (node: unknown) => Json | undefined,
  root: Json,
  group: string[]
): ApiRequest => {
  const params: KeyValue[] = []
  const headers: KeyValue[] = []

  const allParams = [...pathLevelParams, ...asArray(operation.parameters)]
  for (const rawParam of allParams) {
    const param = resolve(rawParam)
    if (!param || typeof param.name !== 'string') continue
    const value = toParamValue(exampleFor(param.schema, resolve) ?? param.example)
    const description = typeof param.description === 'string' ? param.description : ''

    if (param.in === 'query') params.push(makeKv(param.name, value, description))
    else if (param.in === 'header') headers.push(makeKv(param.name, value, description))
  }

  let body: BodyConfig = { format: 'none', content: '' }
  const requestBody = resolve(operation.requestBody)
  const content = isObject(requestBody) && isObject(requestBody.content) ? (requestBody.content as Json) : null
  const mediaType = content && (content['application/json'] ?? content['application/*+json'] ?? findJsonLike(content))
  if (mediaType) {
    const media = resolve(mediaType) ?? {}
    const example = exampleFor(media.schema ?? media, resolve)
    body = { format: 'json', content: JSON.stringify(example, null, 2) }
    if (!headers.some((header) => header.key.toLowerCase() === 'content-type')) {
      headers.push(makeKv('Content-Type', 'application/json'))
    }
  }

  const name =
    (typeof operation.operationId === 'string' && operation.operationId) ||
    (typeof operation.summary === 'string' && operation.summary) ||
    `${method} ${path}`

  return {
    id: uid('req'),
    name,
    method,
    url: `${baseUrl}${path}`,
    params,
    headers,
    auth: authFromSecurity(operation, root, resolve),
    body,
    ...(group.length > 0 ? { group } : {})
  }
}

const buildDroppedRequest = (dropped: Json, group: string[]): ApiRequest => {
  const request = isObject(dropped.request) ? (dropped.request as Json) : {}
  const rawBody = isObject(request.body) ? (request.body as Json) : {}
  const contentType = asString(rawBody.contentType)
  const content = asString(rawBody.body)

  let body: BodyConfig = { format: 'none', content: '' }
  if (content || contentType) {
    if (contentType.includes('json')) body = { format: 'json', content: content || '{}' }
    else body = { format: 'raw', content }
  }

  const params = asArray(request.params).map((param) =>
    makeKv(asString(param.key), asString(param.value), asString(param.description), param.active !== false)
  )
  const headers = asArray(request.headers).map((header) =>
    makeKv(asString(header.key), asString(header.value), asString(header.description), header.active !== false)
  )

  const method = asString(request.method).toUpperCase() as HttpMethod

  return {
    id: uid('req'),
    name: asString(request.name) || `${method} ${asString(request.endpoint)}`,
    method: OPERATION_METHODS.includes(method) ? method : 'GET',
    url: asString(request.endpoint),
    params,
    headers,
    auth: authFromDropped(request.auth),
    body,
    ...(group.length > 0 ? { group } : {})
  }
}

export function parseOpenApiCollections(text: string): Collection[] {
  let root: Json
  try {
    root = JSON.parse(text) as Json
  } catch {
    throw new Error('File bukan JSON yang valid.')
  }

  if (!isObject(root) || (typeof root.openapi !== 'string' && typeof root.swagger !== 'string')) {
    throw new Error('File ini bukan OpenAPI specification (field "openapi" tidak ditemukan).')
  }
  if (!isObject(root.paths)) {
    throw new Error('OpenAPI ini tidak memiliki "paths".')
  }

  const resolve = createResolver(root)
  const servers = Array.isArray(root.servers) ? root.servers : []
  const firstServer =
    isObject(servers[0]) && typeof (servers[0] as Json).url === 'string'
      ? ((servers[0] as Json).url as string)
      : ''
  const baseUrl = firstServer.replace(/\/$/, '')

  const info = isObject(root.info) ? root.info : {}
  const defaultCollection =
    typeof info.title === 'string' && info.title.trim() ? info.title.trim() : 'Imported API'

  const byName = new Map<string, Collection>()
  const collect = (collectionName: string, request: ApiRequest) => {
    let collection = byName.get(collectionName)
    if (!collection) {
      collection = { id: uid('col'), name: collectionName, requests: [] }
      byName.set(collectionName, collection)
    }
    collection.requests.push(request)
  }

  let operationCount = 0
  for (const [path, rawPathItem] of Object.entries(root.paths)) {
    const pathItem = resolve(rawPathItem)
    if (!pathItem) continue
    const pathLevelParams = asArray(pathItem.parameters)
    for (const method of OPERATION_METHODS) {
      const operation = pathItem[method.toLowerCase()]
      if (!isObject(operation)) continue

      const tags = Array.isArray(operation.tags) ? operation.tags : []
      const folder = typeof tags[0] === 'string' ? splitTagPath(tags[0]) : null
      const collectionName = folder?.collection ?? defaultCollection
      const group = folder?.group ?? []

      collect(
        collectionName,
        buildOperationRequest(method, path, operation, pathLevelParams, baseUrl, resolve, root, group)
      )
      operationCount += 1
    }
  }

  const dropped = asArray(root['x-hoppscotch-dropped-requests'])
  for (const item of dropped) {
    const tagPath = asString(item.tagPath)
    const folder = tagPath ? splitTagPath(tagPath) : null
    collect(folder?.collection ?? defaultCollection, buildDroppedRequest(item, folder?.group ?? []))
  }

  const collections = Array.from(byName.values())
  if (collections.length === 0 || (operationCount === 0 && dropped.length === 0)) {
    throw new Error('Tidak ada endpoint yang ditemukan di spec ini.')
  }
  return collections
}
