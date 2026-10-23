import { useState } from 'react'
import KeyValueTable from './KeyValueTable'
import { Copy } from './Icons'
import type { KeyValue } from '../types/api'

interface HeadersEditorProps {
  headers: KeyValue[]
  onChange: (headers: KeyValue[]) => void
}

export default function HeadersEditor({ headers, onChange }: HeadersEditorProps) {
  const [copied, setCopied] = useState(false)
  const enabled = headers.filter((header) => header.enabled && header.key.trim())

  const copyHeaders = async () => {
    const text = enabled.map((header) => `${header.key.trim()}: ${header.value}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
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
        <button
          type="button"
          onClick={copyHeaders}
          disabled={enabled.length === 0}
          title="Copy enabled request headers"
          className="btn shrink-0 border border-studio-border text-xs text-studio-muted hover:bg-studio-strong/50 hover:text-studio-text disabled:opacity-40"
        >
          <Copy className="h-3.5 w-3.5" />
          {copied ? 'Copied' : 'Copy headers'}
        </button>
      </div>
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
