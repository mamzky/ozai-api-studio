import { useCallback, useRef } from 'react'
import VariableText from './VariableText'

interface HighlightedTextareaProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  containerClassName?: string
  contentClassName?: string
}

export default function HighlightedTextarea({
  value,
  onValueChange,
  placeholder,
  containerClassName = '',
  contentClassName = ''
}: HighlightedTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current
    const backdrop = backdropRef.current
    if (!textarea || !backdrop) return
    backdrop.scrollTop = textarea.scrollTop
    backdrop.scrollLeft = textarea.scrollLeft
  }, [])

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      <div
        ref={backdropRef}
        aria-hidden
        className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words font-mono text-xs leading-6 ${contentClassName}`}
      >
        {value.length > 0 && <VariableText value={value} />}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
        placeholder={placeholder}
        className={`studio-scroll absolute inset-0 h-full w-full resize-none bg-transparent font-mono text-xs leading-6 text-transparent caret-sky-300 outline-none placeholder:text-studio-faint ${contentClassName}`}
      />
    </div>
  )
}
