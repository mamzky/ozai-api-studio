import { useCallback, useRef, type InputHTMLAttributes } from 'react'
import VariableText from './VariableText'

type NativeProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'className'>

interface HighlightedInputProps extends NativeProps {
  value: string
  onValueChange: (value: string) => void
  containerClassName?: string
  contentClassName?: string
}

export default function HighlightedInput({
  value,
  onValueChange,
  containerClassName = '',
  contentClassName = '',
  placeholder,
  ...rest
}: HighlightedInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  const syncScroll = useCallback(() => {
    const input = inputRef.current
    const backdrop = backdropRef.current
    if (input && backdrop) backdrop.scrollLeft = input.scrollLeft
  }, [])

  return (
    <div className={`relative flex items-center overflow-hidden ${containerClassName}`}>
      <div
        ref={backdropRef}
        aria-hidden
        className={`pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre font-mono ${contentClassName}`}
      >
        {value.length > 0 && <VariableText value={value} />}
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onScroll={syncScroll}
        spellCheck={false}
        placeholder={placeholder}
        className={`relative h-full w-full bg-transparent font-mono text-transparent caret-sky-300 outline-none placeholder:text-studio-faint ${contentClassName}`}
        {...rest}
      />
    </div>
  )
}
