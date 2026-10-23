import { METHOD_STYLES } from '../lib/methods'
import { X } from './Icons'
import type { HttpMethod } from '../types/api'

export interface RequestTabItem {
  id: string
  name: string
  method: HttpMethod
  mock: boolean
}

interface RequestTabBarProps {
  tabs: RequestTabItem[]
  activeId: string | null
  onSelect: (requestId: string) => void
  onClose: (requestId: string) => void
}

export default function RequestTabBar({ tabs, activeId, onSelect, onClose }: RequestTabBarProps) {
  if (tabs.length === 0) return null

  return (
    <div
      role="tablist"
      aria-label="Open request tabs"
      className="studio-scroll flex shrink-0 items-stretch overflow-x-auto border-b border-studio-border bg-studio-panel/60"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId
        const method = METHOD_STYLES[tab.method]
        return (
          <div
            key={tab.id}
            onAuxClick={(event) => {
              if (event.button === 1) {
                event.preventDefault()
                onClose(tab.id)
              }
            }}
            className={`group relative flex min-w-[150px] max-w-[220px] shrink-0 items-center border-r border-studio-border transition-colors ${
              active ? 'bg-studio-bg text-studio-text' : 'text-studio-muted hover:bg-studio-strong/30 hover:text-studio-text'
            }`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(tab.id)}
              title={`${tab.method} ${tab.name}`}
              className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 pr-1 text-left"
            >
              <span className={`shrink-0 font-mono text-[10px] font-bold ${method.text}`}>{tab.method}</span>
              <span className="truncate text-xs">{tab.name}</span>
              {tab.mock && <span className="h-1 w-1 shrink-0 rounded-full bg-violet-400/70" title="Mock enabled" />}
            </button>
            <button
              type="button"
              onClick={() => onClose(tab.id)}
              title="Close tab"
              className={`mr-1.5 grid h-5 w-5 shrink-0 place-items-center rounded text-studio-faint transition-colors hover:bg-studio-strong/70 hover:text-studio-text ${
                active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <X className="h-3 w-3" />
            </button>
            {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-studio-accent" />}
          </div>
        )
      })}
    </div>
  )
}
