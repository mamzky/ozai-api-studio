import type { Environment } from '../types/api'

const VARIABLE_TOKEN_SOURCE = '\\{\\{\\s*([\\w.-]+)\\s*\\}\\}|<<\\s*([\\w.-]+)\\s*>>'

export const BASE_URL_KEY = 'base_url'
export const TOKEN_KEY = 'token'

export function buildVariableMap(environment: Environment | null | undefined): Record<string, string> {
  const map: Record<string, string> = {}
  if (!environment) return map
  environment.variables
    .filter((variable) => variable.enabled && variable.key.trim())
    .forEach((variable) => {
      map[variable.key.trim()] = variable.value
    })
  return map
}

export function interpolate(input: string, variables: Record<string, string>): string {
  if (!input || !(input.includes('{{') || input.includes('<<'))) return input
  const regex = new RegExp(VARIABLE_TOKEN_SOURCE, 'g')
  return input.replace(regex, (match, curly: string | undefined, angle: string | undefined) => {
    const key = curly ?? angle ?? ''
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match
  })
}

export function resolveUrl(rawUrl: string, variables: Record<string, string>): string {
  const base = variables[BASE_URL_KEY]?.trim().replace(/\/+$/, '')
  const normalized = base ? { ...variables, [BASE_URL_KEY]: base } : variables
  let url = interpolate(rawUrl.trim(), normalized)
  if (base && url.startsWith('/')) {
    url = `${base}${url}`
  }
  return url
}

export function hasVariables(value: string): boolean {
  return new RegExp(VARIABLE_TOKEN_SOURCE).test(value)
}

export interface VariableSegment {
  text: string
  variable: boolean
}

export function splitVariables(value: string): VariableSegment[] {
  const segments: VariableSegment[] = []
  if (!value) return segments
  const regex = new RegExp(VARIABLE_TOKEN_SOURCE, 'g')
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(value)) !== null) {
    if (match.index > lastIndex) segments.push({ text: value.slice(lastIndex, match.index), variable: false })
    segments.push({ text: match[0], variable: true })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < value.length) segments.push({ text: value.slice(lastIndex), variable: false })
  return segments
}
