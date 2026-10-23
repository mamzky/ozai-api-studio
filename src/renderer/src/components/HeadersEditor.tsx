import { useEffect, useRef, useState } from 'react'
import KeyValueTable from './KeyValueTable'
import { ClipboardPaste, Copy } from './Icons'
import { uid } from '../lib/format'
import type { KeyValue } from '../types/api'

interface HeadersEditorProps {
  headers: KeyValue[]
  onChange: (headers: KeyValue[]) => void
}

interface Notice {
  text: string
  error?: boolean
}

export default function HeadersEditor({ headers, onChange }: HeadersEditorProps) {
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const noticeTimer = useRef<number | null>(null)

  const enabled = headers.filter((header) => header.enabled && header.key.trim())

  useEffect(
    () => () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    },
    []
  )

  const showNotice = (text: string, error = false) => {
    setNotice({ text, error })
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2200)
  }

  const copyHeaders = async () => {
    const text = enabled.map((header) => `${header.key.trim()}: ${header.value}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
      showNotice('Gagal menulis ke clipboard.', true)
    }
  }

  const pasteHeaders = async () => {
    try {
      const text = window.api?.readClipboard
        ? await window.api.readClipboard()
        : await navigator.clipboard.readText()

      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'))

      const parsed: { key: string; value: string }[] = []
      for (const line of lines) {
        const index = line.indexOf(':')
        if (index <= 0) continue
        const key = line.slice(0, index).trim()
        const value = line.slice(index + 1).trim()
        if (!key || /\s/.test(key)) continue
        parsed.push({ key, value })
      }

      if (parsed.length === 0) {
        showNotice('Clipboard tidak berisi header valid. Format: Key: Value', true)
        return
      }

      const next = headers.map((header) => ({ ...header }))
      let added = 0
      let updated = 0

      parsed.forEach(({ key, value }) => {
        const existing = next.findIndex(
          (header) => header.key.trim().toLowerCase() === key.toLowerCase()
        )
        if (existing >= 0) {
          next[existing] = { ...next[existing], key: next[existing].key, value, enabled: true }
          updated += 1
        } else {
          next.push({ id: uid('kv'), key, value, description: '', enabled: true })
          added += 1
        }
      })

      onChange(next)
      const skipped = lines.length - parsed.length
      showNotice(
        `${added} ditambahkan, ${updated} di-update${skipped > 0 ? `, ${skipped} baris di-skip` : ''}`
      )
    } catch {
      showNotice('Gagal membaca clipboard.', true)
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-studio-text">Headers</h3>
          <p className="mt-0.5 text-xs text-studio-muted">
            Headers are sent with the request. Duplicate keys are allowed.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={copyHeaders}
            disabled={enabled.length === 0}
            title="Copy enabled request headers"
            className="btn border border-studio-border text-xs text-studio-muted hover:bg-studio-strong/50 hover:text-studio-text disabled:opacity-40"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? 'Copied' : 'Copy headers'}
          </button>
          <button
            type="button"
            onClick={pasteHeaders}
            title="Paste headers from clipboard (Key: Value)"
            className="btn border border-studio-border text-xs text-studio-muted hover:bg-studio-strong/50 hover:text-studio-text"
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Paste headers
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`mb-3 rounded-md border px-2.5 py-1.5 text-2xs ${
            notice.error
              ? 'border-red-500/30 bg-red-500/10 text-red-300'
              : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {notice.text}
        </div>
      )}

      <KeyValueTable
        rows={headers}
        onChange={onChange}
        addLabel="Add Header"
        keyPlaceholder="Header"
        valuePlaceholder="Value"
        emptyHint="No headers. Click “Add Header” to create one."
      />
    </div>
  )
}
