import type { AuthConfig, BodyConfig, KeyValue } from '../types/api'

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function buildFinalUrl(base: string, params: KeyValue[]): string {
  const trimmed = base.trim()
  const active = params.filter((param) => param.enabled && param.key.trim())
  if (active.length === 0) return trimmed

  try {
    const url = new URL(trimmed)
    active.forEach((param) => url.searchParams.append(param.key.trim(), param.value))
    return url.toString()
  } catch {
    const query = active
      .map((param) => `${encodeURIComponent(param.key.trim())}=${encodeURIComponent(param.value)}`)
      .join('&')
    return `${trimmed}${trimmed.includes('?') ? '&' : '?'}${query}`
  }
}

const hasHeader = (headers: Record<string, string>, name: string): boolean =>
  Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase())

export function buildHeaders(
  headers: KeyValue[],
  auth: AuthConfig,
  body: BodyConfig,
  encodeBasic: (value: string) => string
): Record<string, string> {
  const result: Record<string, string> = {}

  headers
    .filter((header) => header.enabled && header.key.trim())
    .forEach((header) => {
      result[header.key.trim()] = header.value
    })

  if (auth.type === 'bearer' && auth.token && !hasHeader(result, 'authorization')) {
    result['Authorization'] = `Bearer ${auth.token}`
  }

  if (auth.type === 'basic' && (auth.username || auth.password) && !hasHeader(result, 'authorization')) {
    result['Authorization'] = `Basic ${encodeBasic(`${auth.username}:${auth.password}`)}`
  }

  if (auth.type === 'api-key' && auth.apiKeyName && !hasHeader(result, auth.apiKeyName)) {
    result[auth.apiKeyName] = auth.apiKeyValue
  }

  if (body.format === 'json' && body.content.trim() && !hasHeader(result, 'content-type')) {
    result['Content-Type'] = 'application/json'
  }

  return result
}

export function validateJsonBody(body: BodyConfig): string | null {
  if (body.format !== 'json') return null
  const content = body.content.trim()
  if (!content) return null
  try {
    JSON.parse(content)
    return null
  } catch (error) {
    return (error as Error).message
  }
}

export function encodeBase64(value: string): string {
  try {
    return window.btoa(value)
  } catch {
    return value
  }
}
