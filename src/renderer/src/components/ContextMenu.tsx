import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronRight } from './Icons'

export interface ContextMenuItem {
  label: string
  onSelect?: () => void
  danger?: boolean
  disabled?: boolean
  submenu?: ContextMenuItem[]
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

const itemClass = (danger?: boolean) =>
  `flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
    danger ? 'text-red-400 hover:bg-red-500/15' : 'text-studio-muted hover:bg-studio-strong/60 hover:text-studio-text'
  }`

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x, y })
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null)

  useLayoutEffect(() => {
    const element = menuRef.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    setPosition({
      x: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))
    })
  }, [x, y])

  useEffect(() => {
    const handleClose = () => onClose()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handleClose)
    window.addEventListener('resize', handleClose)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClose)
      window.removeEventListener('resize', handleClose)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const handleSelect = (item: ContextMenuItem) => {
    if (item.disabled || item.submenu) return
    item.onSelect?.()
    onClose()
  }

  return (
    <div
      ref={menuRef}
      style={{ left: position.x, top: position.y }}
      onMouseDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      className="fixed z-50 min-w-[180px] rounded-lg border border-studio-border bg-studio-elevated p-1 shadow-panel"
    >
      {items.map((item, index) => (
        <div
          key={`${item.label}-${index}`}
          className="relative"
          onMouseEnter={() => setOpenSubmenu(item.submenu ? index : null)}
        >
          <button
            type="button"
            disabled={item.disabled}
            onClick={() => handleSelect(item)}
            className={itemClass(item.danger)}
          >
            <span className="flex-1 truncate text-left">{item.label}</span>
            {item.submenu && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-studio-faint" />}
          </button>

          {item.submenu && openSubmenu === index && (
            <div className="absolute left-full top-0 z-50 ml-1 max-h-72 min-w-[180px] overflow-auto rounded-lg border border-studio-border bg-studio-elevated p-1 shadow-panel studio-scroll">
              {item.submenu.map((sub, subIndex) => (
                <button
                  key={`${sub.label}-${subIndex}`}
                  type="button"
                  disabled={sub.disabled}
                  onClick={() => handleSelect(sub)}
                  className={itemClass(sub.danger)}
                >
                  <span className="flex-1 truncate text-left">{sub.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
