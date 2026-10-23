import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import JsonView from './JsonView'
import { formatBytes } from '../lib/format'
import { statusBg, statusTone } from '../lib/methods'
import { Bolt, Spinner } from './Icons'
import type { ApiResponse, RequestError, RequestErrorKind } from '../types/api'

interface ResponseViewerProps {
  response: ApiResponse | null
  error: RequestError | null
  loading: boolean
  heightPct: number
  onContextMenuSelection: (event: ReactMouseEvent, text: string) => void
}

type ResponseTab = 'body' | 'headers'

const ERROR_COPY: Record<RequestErrorKind, { title: string; body: string }> = {
  'invalid-url': { title: 'Invalid URL', body: 'Please check the request URL and try again.' },
  network: { title: 'Request Failed', body: 'Unable to connect to the server.' },
  timeout: { title: 'Request Timeout', body: 'The server took too long to respond.' },
  'invalid-json': { title: 'Invalid JSON body', body: 'Please check your request body.' },
  unknown: { title: 'Request Failed', body: 'Something went wrong while sending the request.' }
}

export default function ResponseViewer({ response, error, loading, heightPct, onContextMenuSelection }: ResponseViewerProps) {
  const [tab, setTab] = useState<ResponseTab>('body')
  const [copied, setCopied] = useState(false)
  const selectionRef = useRef('')

  const captureSelection = () => {
    selectionRef.current = window.getSelection()?.toString() ?? ''
  }

  const handleContextMenu = (event: ReactMouseEvent) => {
    const selected = (selectionRef.current || window.getSelection()?.toString() || '').trim()
    if (!selected) return
    event.preventDefault()
    onContextMenuSelection(event, selected)
  }

  const copyBody = async () => {
    if (!response) return
    try {
      await navigator.clipboard.writeText(response.body)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  const tabs: { id: ResponseTab; label: string }[] = [
    { id: 'body', label: 'Body' },
    { id: 'headers', label: 'Headers' }
  ]

  const errorCopy = error ? ERROR_COPY[error.kind] : null

  return (
    <section
      style={{ height: `${heightPct}%` }}
      className="flex min-h-[120px] shrink-0 flex-col bg-studio-panel"
    >
      <div className="flex items-center gap-3 border-b border-studio-border px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-studio-faint">Response</span>

        {response && !loading && !error && (
          <div className="flex items-center gap-3">
            <span
              className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold ${statusBg(response.status)} ${statusTone(response.status)}`}
            >
              {response.status} {response.statusText}
            </span>
            <span className="font-mono text-xs text-studio-muted">{response.timeMs} ms</span>
            <span className="font-mono text-xs text-studio-muted">{formatBytes(response.sizeKb)}</span>
            {response.mocked && (
              <span className="flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-2xs font-medium text-violet-300">
                <Bolt className="h-2.5 w-2.5" />
                Mock
              </span>
            )}
          </div>
        )}

        {error && !loading && (
          <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-red-400">
            Error
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {!error &&
            tabs.map((item) => {
              const active = tab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`relative rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    active ? 'bg-studio-strong/60 text-studio-text' : 'text-studio-muted hover:text-studio-text'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          <button
            type="button"
            onClick={copyBody}
            disabled={!response || Boolean(error)}
            className="ml-1 rounded-md px-2 py-1 text-xs text-studio-muted transition-colors hover:bg-studio-strong/50 hover:text-studio-text disabled:opacity-40"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div
        className="studio-scroll min-h-0 flex-1 overflow-auto"
        onMouseUp={captureSelection}
        onContextMenu={handleContextMenu}
      >
        {loading && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-studio-muted">
            <Spinner className="h-4 w-4" />
            Sending request…
          </div>
        )}

        {!loading && errorCopy && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
              !
            </div>
            <p className="mt-3 text-sm font-semibold text-studio-text">{errorCopy.title}</p>
            <p className="mt-1 text-xs text-studio-muted">{error?.detail ?? errorCopy.body}</p>
            {error?.detail && errorCopy.body !== error.detail && (
              <p className="mt-1 text-xs text-studio-faint">{errorCopy.body}</p>
            )}
          </div>
        )}

        {!loading && !error && !response && (
          <div className="flex h-full items-center justify-center text-sm text-studio-faint">
            Send a request to see the response here.
          </div>
        )}

        {!loading && !error && response && tab === 'body' && (
          <JsonView content={response.body} className="whitespace-pre px-4 py-3 font-mono text-xs leading-relaxed" />
        )}

        {!loading && !error && response && tab === 'headers' && (
          <div className="divide-y divide-studio-border/70">
            {response.headers.length === 0 && (
              <div className="px-4 py-6 text-sm text-studio-faint">No response headers.</div>
            )}
            {response.headers.map((header, index) => (
              <div key={`${header.key}-${index}`} className="grid grid-cols-[220px_1fr] gap-3 px-4 py-2">
                <span className="truncate font-mono text-xs text-sky-300">{header.key}</span>
                <span className="break-all font-mono text-xs text-studio-muted">{header.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
