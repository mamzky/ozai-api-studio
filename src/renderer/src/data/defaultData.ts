import type {
  ApiRequest,
  AuthConfig,
  BodyConfig,
  BodyFormat,
  Collection,
  Environment,
  EnvVariable,
  KeyValue
} from '../types/api'
import { uid } from '../lib/format'

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

export function createDefaultEnvironments(): Environment[] {
  return [
    {
      id: uid('env'),
      name: 'Development',
      variables: [
        envVar('base_url', 'https://jsonplaceholder.typicode.com'),
        envVar('token', '')
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
    ...partial
  }
}

export function createDefaultCollections(): Collection[] {
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
