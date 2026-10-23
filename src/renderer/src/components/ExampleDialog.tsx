import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Bookmark } from './Icons'
import { statusBg, statusTone } from '../lib/methods'
import { STATUS_SUGGESTIONS, statusTextFor } from '../lib/status'

interface ExampleDialogProps {
  defaultName: string
  defaultStatus: number
  defaultStatusText: string
  onSave: (values: { name: string; status: number; statusText: string }) => void
  onCancel: () => void
}

export default function ExampleDialog({
  defaultName,
  defaultStatus,
  defaultStatusText,
  onSave,
  onCancel
}: ExampleDialogProps) {
  const [name, setName] = useState(defaultName)
  const [status, setStatus] = useState(String(defaultStatus))
  const [statusText, setStatusText] = useState(defaultStatusText || statusTextFor(defaultStatus))
  const nameRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  const updateStatus = (value: string) => {
    setStatus(value)
    const code = Number(value)
    if (Number.isFinite(code)) {
      setStatusText(code === defaultStatus ? defaultStatusText || statusTextFor(code) : statusTextFor(code))
    }
  }

  const submit = () => {
    const trimmed = name.trim()
    const code = Number(status)
    if (!trimmed || !Number.isInteger(code) || code < 100 || code > 599) return
    onSave({ name: trimmed, status: code, statusText: statusText.trim() })
  }

  const code = Number(status)
  const valid = Boolean(name.trim()) && Number.isInteger(code) && code >= 100 && code <= 599

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
      onMouseDown={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-studio-border bg-studio-elevated shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-studio-border px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-studio-text">
            <Bookmark className="h-4 w-4 text-sky-300" />
            Save as example
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-studio-muted">
            Simpan response ini sebagai contoh dokumentasi di bawah request. Ini tidak mengubah Mock.
          </p>
        </div>

        <div className="space-y-3.5 px-5 py-4">
          <div>
            <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-studio-faint">
              Example name
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submit()
                }
              }}
              spellCheck={false}
              placeholder="Successful login"
              className="field h-9 w-full text-sm"
            />
          </div>

          <div className="flex items-end gap-3">
            <div className="w-32">
              <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-studio-faint">
                Status
              </label>
              <input
                value={status}
                onChange={(event) => updateStatus(event.target.value)}
                inputMode="numeric"
                list="example-status-codes"
                spellCheck={false}
                className="field h-9 w-full font-mono text-sm"
              />
              <datalist id="example-status-codes">
                {STATUS_SUGGESTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value} {statusTextFor(value)}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="flex-1">
              <div className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-studio-faint">
                Preview
              </div>
              <div className="flex h-9 items-center">
                <span
                  className={`rounded-md border px-2 py-1 font-mono text-[11px] font-semibold ${
                    Number.isFinite(code) ? `${statusBg(code)} ${statusTone(code)}` : 'border-studio-border text-studio-faint'
                  }`}
                >
                  {Number.isFinite(code) ? code : '—'} {statusText || 'Unknown'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-studio-faint">
              Status text
            </label>
            <input
              value={statusText}
              onChange={(event) => setStatusText(event.target.value)}
              spellCheck={false}
              placeholder="OK"
              className="field h-9 w-full text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-studio-border px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn border border-studio-border text-xs text-studio-muted hover:bg-studio-strong/50 hover:text-studio-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid}
            className="btn bg-studio-accent text-xs text-white hover:bg-blue-500 disabled:opacity-50"
          >
            <Bookmark className="h-3.5 w-3.5" />
            Save example
          </button>
        </div>
      </div>
    </div>
  )
}
