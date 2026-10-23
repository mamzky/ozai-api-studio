import type {
  ApiRequest,
  AppData,
  AuthConfig,
  BodyConfig,
  BodyFormat,
  Collection,
  Environment,
  EnvVariable,
  KeyValue,
  MockResponse
} from '../types/api'
import { uid } from '../lib/format'
import seed from './seedWorkspace.json'

/**
 * Seed workspace exported from the web app and imported into the desktop app.
 * Keeping it as JSON makes it easy to refresh the demo collections later.
 */
const seedWorkspace = (seed as unknown as { workspace: AppData }).workspace

export const emptyAuth = (): AuthConfig => ({
  type: 'none',
  token: '',
  username: '',
  password: '',
  apiKeyName: '',
  apiKeyValue: ''
})

export const emptyBody = (format: BodyFormat = 'none'): BodyConfig => ({
  format,
  content: ''
})

export const kv = (key: string, value: string, description = '', enabled = true): KeyValue => ({
  id: uid('kv'),
  key,
  value,
  description,
  enabled
})

export const envVar = (key: string, value: string, enabled = true): EnvVariable => ({
  id: uid('env'),
  key,
  value,
  description: '',
  enabled
})

export function createEnvironment(name = 'New Environment'): Environment {
  return {
    id: uid('env'),
    name,
    variables: [envVar('base_url', ''), envVar('token', '')]
  }
}

const cloneKeyValues = (rows: KeyValue[] | undefined): KeyValue[] =>
  (rows ?? []).map((row) => ({ ...row, id: uid('kv') }))

const cloneMockResponse = (mock: MockResponse | undefined): MockResponse | undefined =>
  mock
    ? {
        ...mock,
        headers: mock.headers.map((header) => ({ ...header }))
      }
    : undefined

const cloneRequest = (request: ApiRequest): ApiRequest => ({
  ...request,
  id: uid('req'),
  params: cloneKeyValues(request.params),
  headers: cloneKeyValues(request.headers),
  auth: { ...emptyAuth(), ...request.auth },
  body: {
    format: request.body?.format ?? 'none',
    content: request.body?.content ?? ''
  },
  mock: request.mock ?? Boolean(request.mockResponse),
  mockResponse: cloneMockResponse(request.mockResponse)
})

export function createDefaultEnvironments(): Environment[] {
  const seeded = (seedWorkspace.environments ?? []).map((environment) => ({
    id: uid('env'),
    name: environment.name,
    variables: cloneKeyValues(environment.variables)
  }))

  if (seeded.length > 0) return seeded

  return [
    {
      id: uid('env'),
      name: 'Development',
      variables: [
        envVar('base_url', 'https://dummyjson.com'),
        envVar('token', 'demo-token')
      ]
    }
  ]
}

export function createRequest(partial: Partial<ApiRequest> = {}): ApiRequest {
  return {
    id: uid('req'),
    name: 'New Request',
    method: 'GET',
    url: 'https://example.com',
    params: [],
    headers: [],
    auth: emptyAuth(),
    body: emptyBody('none'),
    mock: false,
    ...partial
  }
}

export function createDefaultCollections(): Collection[] {
  if (!Array.isArray(seedWorkspace.collections) || seedWorkspace.collections.length === 0) {
    return [
      {
        id: uid('col'),
        name: 'My Collection',
        requests: [
          createRequest({
            name: 'Get Users',
            method: 'GET',
            url: '{{base_url}}/users'
          }),
          createRequest({
            name: 'Get User Detail',
            method: 'GET',
            url: '{{base_url}}/users/1'
          }),
          createRequest({
            name: 'Create User',
            method: 'POST',
            url: '{{base_url}}/users',
            headers: [kv('Content-Type', 'application/json')],
            body: {
              format: 'json',
              content: '{\n  "name": "John Doe",\n  "email": "john@example.com"\n}'
            }
          })
        ]
      }
    ]
  }

  return seedWorkspace.collections.map((collection) => ({
    id: uid('col'),
    name: collection.name,
    requests: collection.requests.map(cloneRequest)
  }))
}

export function findRequest(
  collections: Collection[],
  requestId: string | null
): { request: ApiRequest; collection: Collection } | null {
  if (!requestId) return null
  for (const collection of collections) {
    const request = collection.requests.find((item) => item.id === requestId)
    if (request) return { request, collection }
  }
  return null
}

export function findCollection(collections: Collection[], collectionId: string | null): Collection | null {
  if (!collectionId) return null
  return collections.find((collection) => collection.id === collectionId) ?? null
}
