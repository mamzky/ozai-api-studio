import { useEffect, useLayoutEffect, useRef, useState } from 'react'

interface PromptDialogProps {
  title: string
  message?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

export default function PromptDialog({
  title,
  message,
  defaultValue = '',
  placeholder = '',
  confirmLabel = 'OK',
  onConfirm,
  onCancel
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
      onMouseDown={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-studio-border bg-studio-elevated p-5 shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-studio-text">{title}</h2>
        {message && <p className="mt-2 text-sm text-studio-muted">{message}</p>}

        <input
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
          className="field mt-3 w-full font-mono text-sm"
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            title="Cancel without saving"
            className="btn border border-studio-border text-studio-muted hover:bg-studio-strong/50 hover:text-studio-text"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!value.trim()}
            title="Apply this change"
            className="btn bg-studio-accent text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
