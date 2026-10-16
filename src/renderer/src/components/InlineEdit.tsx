import { useLayoutEffect, useRef, useState } from 'react'

interface InlineEditProps {
  value: string
  onCommit: (value: string) => void
  onCancel: () => void
  className?: string
}

export default function InlineEdit({ value, onCommit, onCancel, className = '' }: InlineEditProps) {
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const finishedRef = useRef(false)

  useLayoutEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const finish = (commit: boolean) => {
    if (finishedRef.current) return
    finishedRef.current = true
    if (commit) onCommit(draft.trim() || value)
    else onCancel()
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      spellCheck={false}
      onChange={(event) => setDraft(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          finish(true)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          finish(false)
        }
      }}
      className={`w-full rounded border border-studio-accent/60 bg-studio-elevated px-1.5 py-0.5 text-sm text-studio-text outline-none ring-2 ring-studio-accent/20 ${className}`}
    />
  )
}
