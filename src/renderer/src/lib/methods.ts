import type { HttpMethod } from '../types/api'

export interface MethodStyle {
  text: string
  bg: string
  border: string
  dot: string
}

export const METHOD_STYLES: Record<HttpMethod, MethodStyle> = {
  GET: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400'
  },
  POST: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400'
  },
  PUT: {
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    dot: 'bg-blue-400'
  },
  PATCH: {
    text: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    dot: 'bg-violet-400'
  },
  DELETE: {
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    dot: 'bg-red-400'
  },
  HEAD: {
    text: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    dot: 'bg-sky-400'
  },
  OPTIONS: {
    text: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
    dot: 'bg-pink-400'
  }
}

export const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export function statusTone(status: number): string {
  if (status >= 200 && status < 300) return 'text-emerald-400'
  if (status >= 300 && status < 400) return 'text-sky-400'
  if (status >= 400 && status < 500) return 'text-amber-400'
  return 'text-red-400'
}

export function statusBg(status: number): string {
  if (status >= 200 && status < 300) return 'bg-emerald-500/10 border-emerald-500/30'
  if (status >= 300 && status < 400) return 'bg-sky-500/10 border-sky-500/30'
  if (status >= 400 && status < 500) return 'bg-amber-500/10 border-amber-500/30'
  return 'bg-red-500/10 border-red-500/30'
}
