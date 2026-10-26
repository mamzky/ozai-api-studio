import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from './Icons'

export interface DropdownOption {
  value: string
  label: ReactNode
}

interface DropdownProps {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  renderValue?: (option: DropdownOption | undefined) => ReactNode
  triggerClassName?: string
  menuClassName?: string
  showChevron?: boolean
}

export default function Dropdown({
  value,
  options,
  onChange,
  renderValue,
  triggerClassName = 'field flex items-center justify-between gap-2 min-w-[140px]',
  menuClassName = 'absolute z-30 mt-1 min-w-full max-h-72 overflow-auto studio-scroll rounded-lg border border-studio-border bg-studio-elevated p-1 shadow-panel',
  showChevron = true
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <div className="relative no-drag" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title={open ? 'Close the option list' : 'Open the option list'}
        className={triggerClassName}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {renderValue ? renderValue(selected) : selected?.label}
        </span>
        {showChevron && <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-studio-faint transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>

      {open && (
        <div className={menuClassName}>
          {options.map((option) => {
            const active = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                title={typeof option.label === 'string' ? option.label : undefined}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                  active ? 'bg-studio-accent/15 text-studio-text' : 'text-studio-muted hover:bg-studio-strong/60 hover:text-studio-text'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
