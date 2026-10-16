import { prettyJson } from '../lib/format'
import HighlightedTextarea from './HighlightedTextarea'
import type { BodyConfig, BodyFormat } from '../types/api'

interface BodyEditorProps {
  body: BodyConfig
  onChange: (body: BodyConfig) => void
}

const formats: { value: BodyFormat; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'raw', label: 'Raw' }
]

const isValidJson = (content: string): boolean => {
  if (!content.trim()) return true
  try {
    JSON.parse(content)
    return true
  } catch {
    return false
  }
}

export default function BodyEditor({ body, onChange }: BodyEditorProps) {
  const patch = (partial: Partial<BodyConfig>) => onChange({ ...body, ...partial })

  const lineCount = body.content.length === 0 ? 1 : body.content.split('\n').length
  const jsonInvalid = body.format === 'json' && !isValidJson(body.content)

  return (
    <div className="flex h-full flex-col px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-1 rounded-lg border border-studio-border bg-studio-elevated/50 p-0.5">
          {formats.map((format) => {
            const active = body.format === format.value
            return (
              <button
                key={format.value}
                type="button"
                onClick={() => patch({ format: format.value })}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-studio-accent/20 text-studio-text ring-1 ring-inset ring-studio-accent/30'
                    : 'text-studio-muted hover:text-studio-text'
                }`}
              >
                {format.label}
              </button>
            )
          })}
        </div>

        {body.format !== 'none' && (
          <div className="flex items-center gap-2">
            {jsonInvalid && (
              <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-2xs font-medium text-red-400">
                Invalid JSON
              </span>
            )}
            <span className="font-mono text-2xs text-studio-faint">{lineCount} lines</span>
            {body.format === 'json' && (
              <button
                type="button"
                onClick={() => patch({ content: prettyJson(body.content) })}
                className="btn border border-studio-border text-studio-muted hover:bg-studio-strong/50 hover:text-studio-text"
              >
                Beautify
              </button>
            )}
          </div>
        )}
      </div>

      {body.format === 'none' ? (
        <div className="rounded-lg border border-studio-border bg-studio-elevated/40 px-3 py-2.5 text-xs text-studio-muted">
          This request has no body.
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-lg border border-studio-border bg-[#0a0d12]">
          <div className="select-none border-r border-studio-border/70 bg-studio-elevated/20 px-3 py-3 text-right font-mono text-xs leading-6 text-studio-faint">
            {Array.from({ length: Math.max(lineCount, 8) }, (_, index) => (
              <div key={index}>{index + 1}</div>
            ))}
          </div>
          <HighlightedTextarea
            value={body.content}
            onValueChange={(content) => patch({ content })}
            placeholder={body.format === 'json' ? '{\n  "key": "value"\n}' : 'Raw request body...'}
            containerClassName="relative min-w-0 flex-1"
            contentClassName="px-3 py-3"
          />
        </div>
      )}
    </div>
  )
}
