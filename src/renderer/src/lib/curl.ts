import type { AuthConfig, BodyConfig, BodyFormat, HttpMethod, KeyValue } from '../types/api'
import { uid } from './format'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const emptyAuth = (): AuthConfig => ({
  type: 'none',
  token: '',
  username: '',
  password: '',
  apiKeyName: '',
  apiKeyValue: ''
})

const makeKv = (key: string, value: string): KeyValue => ({
  id: uid('kv'),
  key,
  value,
  description: '',
  enabled: true
})

const ANSI_ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  '0': '\0',
  '\\': '\\',
  "'": "'",
  '"': '"',
  a: '\x07',
  b: '\b',
  f: '\f',
  v: '\v'
}

function readAnsiCString(input: string, start: number): { value: string; next: number } {
  let i = start
  let value = ''
  while (i < input.length) {
    const c = input[i]
    if (c === "'") return { value, next: i + 1 }
    if (c === '\\' && i + 1 < input.length) {
      const n = input[i + 1]
      if (n === 'x' && i + 3 < input.length) {
        value += String.fromCharCode(parseInt(input.slice(i + 2, i + 4), 16))
        i += 4
        continue
      }
      if (n === 'u' && i + 5 < input.length) {
        value += String.fromCharCode(parseInt(input.slice(i + 2, i + 6), 16))
        i += 6
        continue
      }
      value += ANSI_ESCAPES[n] ?? n
      i += 2
      continue
    }
    value += c
    i += 1
  }
  return { value, next: i }
}

export function tokenizeShell(input: string): string[] {
  const source = input.replace(/\\\r?\n/g, ' ')
  const tokens: string[] = []
  let current = ''
  let i = 0

  while (i < source.length) {
    const c = source[i]

    if (c === "'") {
      if (current.endsWith('$')) {
        current = current.slice(0, -1)
        const ansi = readAnsiCString(source, i + 1)
        current += ansi.value
        i = ansi.next
        continue
      }
      i += 1
      while (i < source.length && source[i] !== "'") {
        current += source[i]
        i += 1
      }
      i += 1
      continue
    }

    if (c === '"') {
      i += 1
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\\' && i + 1 < source.length) {
          const n = source[i + 1]
          if (n === '"' || n === '\\' || n === '$' || n === '`') {
            current += n
            i += 2
            continue
          }
          if (n === '\n') {
            i += 2
            continue
          }
        }
        current += source[i]
        i += 1
      }
      i += 1
      continue
    }

    if (c === '\\' && i + 1 < source.length) {
      current += source[i + 1]
      i += 2
      continue
    }

    if (/\s/.test(c)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      i += 1
      continue
    }

    current += c
    i += 1
  }

  if (current) tokens.push(current)
  return tokens
}

const IGNORED_VALUE_FLAGS = new Set([
  '-o',
  '--output',
  '--connect-timeout',
  '--max-time',
  '-m',
  '--retry',
  '--retry-delay',
  '--proxy',
  '-x',
  '--cacert',
  '--cert',
  '--key',
  '--resolve',
  '--interface',
  '--limit-rate',
  '-w',
  '--write-out',
  '-c',
  '--cookie-jar',
  '--cert-type',
  '--key-type',
  '--pass'
])

const BOOLEAN_FLAGS = new Set([
  '--compressed',
  '-k',
  '--insecure',
  '-L',
  '--location',
  '-s',
  '--silent',
  '-S',
  '--show-error',
  '-v',
  '--verbose',
  '-i',
  '--include',
  '--http1.0',
  '--http1.1',
  '--http2',
  '--http2-prior-knowledge',
  '--no-buffer',
  '-N',
  '--fail',
  '-f',
  '--globoff',
  '-g',
  '--tlsv1.2',
  '--tlsv1.3',
  '--ipv4',
  '-4',
  '--ipv6',
  '-6'
])

const looksLikeJson = (value: string): boolean => {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return false
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

const parseHeader = (raw: string): KeyValue | null => {
  const index = raw.indexOf(':')
  if (index <= 0) return null
  const key = raw.slice(0, index).trim()
  const value = raw.slice(index + 1).trim()
  if (!key || key.startsWith(':')) return null
  return makeKv(key, value)
}

export function isCurlCommand(input: string): boolean {
  return /^\s*(?:\$|>)?\s*curl\s+/i.test(input)
}

export interface ParsedCurl {
  url: string
  method: HttpMethod
  headers: KeyValue[]
  body: BodyConfig
  auth: AuthConfig
}

export function parseCurl(input: string): ParsedCurl {
  const cleaned = input.trim().replace(/^(?:\$|>)\s+/, '')
  const tokens = tokenizeShell(cleaned)

  if (!tokens.length || tokens[0].toLowerCase() !== 'curl') {
    throw new Error('Bukan perintah cURL yang valid.')
  }

  let method: HttpMethod | null = null
  let url = ''
  let dataJoined: string | null = null
  let dataUrlencode = false
  let jsonFlag = false
  let getMode = false
  let userAgent = ''
  let cookie = ''
  let username = ''
  let password = ''
  let bearer = ''
  const headerValues: string[] = []

  const dataParts: string[] = []
  const formParts: string[] = []

  for (let i = 1; i < tokens.length; i += 1) {
    let token = tokens[i]
    let inlineValue: string | undefined

    if (token.startsWith('--') && token.includes('=')) {
      const eq = token.indexOf('=')
      inlineValue = token.slice(eq + 1)
      token = token.slice(0, eq)
    }

    const takeValue = (): string => {
      if (inlineValue !== undefined) return inlineValue
      const next = tokens[i + 1]
      if (next === undefined) return ''
      i += 1
      return next
    }

    switch (token) {
      case '-X':
      case '--request': {
        const value = takeValue().toUpperCase()
        if (METHODS.includes(value as HttpMethod)) method = value as HttpMethod
        break
      }
      case '-H':
      case '--header':
        headerValues.push(takeValue())
        break
      case '-d':
      case '--data':
      case '--data-raw':
      case '--data-binary':
      case '--data-ascii':
        dataParts.push(takeValue())
        break
      case '--data-urlencode': {
        dataUrlencode = true
        const raw = takeValue()
        const eq = raw.indexOf('=')
        if (eq >= 0) dataParts.push(`${raw.slice(0, eq)}=${encodeURIComponent(raw.slice(eq + 1))}`)
        else dataParts.push(encodeURIComponent(raw))
        break
      }
      case '--json':
        jsonFlag = true
        dataParts.push(takeValue())
        break
      case '-u':
      case '--user': {
        const value = takeValue()
        const idx = value.indexOf(':')
        username = idx >= 0 ? value.slice(0, idx) : value
        password = idx >= 0 ? value.slice(idx + 1) : ''
        break
      }
      case '--oauth2-bearer':
        bearer = takeValue()
        break
      case '-A':
      case '--user-agent':
        userAgent = takeValue()
        break
      case '-b':
      case '--cookie':
        cookie = takeValue()
        break
      case '--url':
        url = takeValue()
        break
      case '-F':
      case '--form':
        formParts.push(takeValue())
        break
      case '-I':
      case '--head':
        method = 'HEAD'
        break
      case '-G':
      case '--get':
        getMode = true
        break
      default: {
        if (token.startsWith('-X') && token.length > 2) {
          const value = token.slice(2).toUpperCase()
          if (METHODS.includes(value as HttpMethod)) method = value as HttpMethod
          break
        }
        if (token.startsWith('-d') && token.length > 2 && !token.startsWith('--')) {
          dataParts.push(token.slice(2))
          break
        }
        if (token.startsWith('-u') && token.length > 2 && !token.startsWith('--')) {
          const value = token.slice(2)
          const idx = value.indexOf(':')
          username = idx >= 0 ? value.slice(0, idx) : value
          password = idx >= 0 ? value.slice(idx + 1) : ''
          break
        }
        if (IGNORED_VALUE_FLAGS.has(token)) {
          takeValue()
          break
        }
        if (BOOLEAN_FLAGS.has(token) || token.startsWith('-')) {
          break
        }
        if (!url) url = token
      }
    }
  }

  if (!url) throw new Error('URL tidak ditemukan di perintah cURL.')

  if (dataParts.length > 0) dataJoined = dataParts.join('&')

  if (getMode && dataJoined) {
    const separator = url.includes('?') ? '&' : '?'
    url = `${url}${separator}${dataJoined}`
    dataJoined = null
  }

  const finalMethod: HttpMethod = method ?? (dataJoined ? 'POST' : 'GET')

  const headers: KeyValue[] = headerValues
    .map(parseHeader)
    .filter((header): header is KeyValue => header !== null)

  if (userAgent && !headers.some((header) => header.key.toLowerCase() === 'user-agent')) {
    headers.push(makeKv('User-Agent', userAgent))
  }
  if (cookie && !headers.some((header) => header.key.toLowerCase() === 'cookie')) {
    headers.push(makeKv('Cookie', cookie))
  }

  let body: BodyConfig = { format: 'none', content: '' }
  let format: BodyFormat = 'none'

  if (dataJoined !== null) {
    format = jsonFlag || looksLikeJson(dataJoined) ? 'json' : 'raw'
    body = { format, content: dataJoined }
  } else if (formParts.length > 0) {
    body = { format: 'raw', content: formParts.join('\n') }
    format = 'raw'
  }

  if (dataUrlencode && dataJoined !== null && format !== 'json') {
    format = 'raw'
    body = { format, content: dataJoined }
  }

  const hasContentType = headers.some((header) => header.key.toLowerCase() === 'content-type')
  if (format === 'json' && !hasContentType) {
    headers.push(makeKv('Content-Type', 'application/json'))
  }
  if (format === 'raw' && dataUrlencode && !hasContentType) {
    headers.push(makeKv('Content-Type', 'application/x-www-form-urlencoded'))
  }

  const auth = emptyAuth()
  if (bearer) {
    auth.type = 'bearer'
    auth.token = bearer
  } else if (username || password) {
    auth.type = 'basic'
    auth.username = username
    auth.password = password
  }

  return { url, method: finalMethod, headers, body, auth }
}
