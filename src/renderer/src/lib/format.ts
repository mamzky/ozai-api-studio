let counter = 0

export function uid(prefix = 'id'): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}_${counter}`
}

export function formatBytes(kb: number): string {
  if (kb < 1) return `${Math.round(kb * 1024)} B`
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(2)} MB`
}

export function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

export function byteSize(value: string): number {
  try {
    return new TextEncoder().encode(value).length / 1024
  } catch {
    return value.length / 1024
  }
}
