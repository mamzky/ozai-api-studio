import type { MouseEvent as ReactMouseEvent } from 'react'
import CollectionTree from './CollectionTree'
import { Bolt, Layers, Plus, Search, Upload } from './Icons'
import type { Collection } from '../types/api'

interface RenameTarget {
  type: 'collection' | 'request'
  id: string
}

interface SidebarProps {
  collections: Collection[]
  expanded: Record<string, boolean>
  onToggle: (collectionId: string) => void
  selectedCollectionId: string | null
  selectedRequestId: string | null
  onSelectCollection: (collectionId: string) => void
  onSelectRequest: (requestId: string) => void
  search: string
  onSearchChange: (value: string) => void
  renaming: RenameTarget | null
  onCollectionContextMenu: (collectionId: string, event: ReactMouseEvent) => void
  onRequestContextMenu: (requestId: string, event: ReactMouseEvent) => void
  onRenameCollection: (collectionId: string, name: string) => void
  onRenameRequest: (requestId: string, name: string) => void
  onCancelRename: () => void
  onNewCollection: () => void
  onNewRequest: (collectionId: string) => void
  onImport: () => void
  onBlankContextMenu: (event: ReactMouseEvent) => void
}

export default function Sidebar({
  collections,
  expanded,
  onToggle,
  selectedCollectionId,
  selectedRequestId,
  onSelectCollection,
  onSelectRequest,
  search,
  onSearchChange,
  renaming,
  onCollectionContextMenu,
  onRequestContextMenu,
  onRenameCollection,
  onRenameRequest,
  onCancelRename,
  onNewCollection,
  onNewRequest,
  onImport,
  onBlankContextMenu
}: SidebarProps) {
  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-studio-border bg-studio-sidebar">
      <div className="flex h-12 items-center gap-2.5 border-b border-studio-border px-4">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow">
          <Bolt className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Ozai API Studio</span>
      </div>

      <div className="border-b border-studio-border px-3 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-studio-faint" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search collection"
            className="field h-8 w-full pl-8 text-xs"
          />
        </div>
      </div>

      <div className="flex items-center justify-between px-3 pb-1 pt-3">
        <span className="text-2xs font-semibold uppercase tracking-wider text-studio-faint">Collections</span>
        <div className="flex items-center gap-0.5">
          <button type="button" className="icon-btn" title="Import OpenAPI or workspace" onClick={onImport}>
            <Upload className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="New Request"
            onClick={() => onNewRequest(selectedCollectionId ?? collections[0]?.id ?? '')}
          >
            <Layers className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        className="studio-scroll flex-1 overflow-y-auto px-2 pb-3"
        onContextMenu={onBlankContextMenu}
      >
        <CollectionTree
          collections={collections}
          expanded={expanded}
          onToggle={onToggle}
          selectedCollectionId={selectedCollectionId}
          selectedRequestId={selectedRequestId}
          onSelectCollection={onSelectCollection}
          onSelectRequest={onSelectRequest}
          search={search}
          renaming={renaming}
          onCollectionContextMenu={onCollectionContextMenu}
          onRequestContextMenu={onRequestContextMenu}
          onRenameCollection={onRenameCollection}
          onRenameRequest={onRenameRequest}
          onCancelRename={onCancelRename}
          onNewRequest={onNewRequest}
        />
      </div>

      <div className="border-t border-studio-border p-3">
        <button
          type="button"
          onClick={onNewCollection}
          className="btn w-full justify-center border border-dashed border-studio-strong text-studio-muted hover:border-studio-accent/50 hover:bg-studio-strong/40 hover:text-studio-text"
        >
          <Plus className="h-3.5 w-3.5" />
          New Collection
        </button>
        <div className="mt-2 flex items-center justify-between px-1 text-2xs text-studio-faint">
          <span>{collections.length} collections</span>
          <span className="font-mono">v0.1.0</span>
        </div>
      </div>
    </aside>
  )
}
