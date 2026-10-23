import { useState } from 'react'
import Dropdown from './Dropdown'
import RequestTabs from './RequestTabs'
import HighlightedInput from './HighlightedInput'
import { HTTP_METHODS, METHOD_STYLES } from '../lib/methods'
import { isCurlCommand, parseCurl } from '../lib/curl'
import { Send, Spinner } from './Icons'
import type { ApiRequest, EnvVariable, HttpMethod } from '../types/api'

interface RequestEditorProps {
  request: ApiRequest
  onChange: (patch: Partial<ApiRequest>) => void
  onSend: () => void
  sending: boolean
  environmentVariables: EnvVariable[]
}

export default function RequestEditor({ request, onChange, onSend, sending, environmentVariables }: RequestEditorProps) {
  const style = METHOD_STYLES[request.method]
  const [curlError, setCurlError] = useState<string | null>(null)

  const applyCurl = (text: string): boolean => {
    if (!isCurlCommand(text)) return false
    try {
      const parsed = parseCurl(text)
      onChange({
        url: parsed.url,
        method: parsed.method,
        headers: parsed.headers,
        body: parsed.body,
        auth: parsed.auth
      })
      setCurlError(null)
    } catch (error) {
      setCurlError((error as Error).message)
    }
    return true
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-studio-border bg-studio-panel px-4 py-3">
        <Dropdown
          value={request.method}
          options={HTTP_METHODS.map((method) => ({
            value: method,
            label: (
              <span className={`font-mono text-xs font-bold ${METHOD_STYLES[method].text}`}>{method}</span>
            )
          }))}
          onChange={(value) => onChange({ method: value as HttpMethod })}
          renderValue={(option) => (
            <span className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
              <span className={`font-mono text-xs font-bold ${style.text}`}>{option?.value}</span>
            </span>
          )}
          triggerClassName={`flex h-9 w-[128px] items-center justify-between gap-2 rounded-md border px-3 ${style.bg} ${style.border}`}
          menuClassName="absolute z-30 mt-1 w-[128px] rounded-lg border border-studio-border bg-studio-elevated p-1 shadow-panel"
        />

        <div className="relative flex-1">
          <HighlightedInput
            value={request.url}
            onValueChange={(url) => {
              if (applyCurl(url)) return
              setCurlError(null)
              onChange({ url })
            }}
            onPaste={(event) => {
              const text = event.clipboardData.getData('text')
              if (!isCurlCommand(text)) return
              event.preventDefault()
              applyCurl(text)
            }}
            placeholder="URL atau paste cURL di sini"
            title="Paste cURL untuk mengisi request otomatis"
            containerClassName="h-9 w-full rounded-md border border-studio-border bg-studio-elevated focus-within:border-studio-accent/70 focus-within:ring-2 focus-within:ring-studio-accent/20"
            contentClassName="px-3 text-xs"
          />
          {curlError && (
            <div className="absolute left-0 top-full z-20 mt-1 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-2xs text-red-300 shadow-panel">
              {curlError}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onSend}
          disabled={sending}
          className="btn h-9 min-w-[92px] justify-center bg-studio-accent text-white shadow hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {sending ? <Spinner /> : <Send />}
          {sending ? 'Sending' : 'Send'}
        </button>
      </div>

      <RequestTabs key={request.id} request={request} onChange={onChange} environmentVariables={environmentVariables} />
    </div>
  )
}
