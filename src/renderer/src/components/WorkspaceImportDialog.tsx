import { useEffect } from 'react'
import { Layers, Upload, X } from './Icons'
import type { WorkspaceImportMode } from '../lib/workspace'

interface WorkspaceImportDialogProps {
  workspaceName: string
  newCollections: string[]
  existingCollections: string[]
  newEnvironments: string[]
  onImport: (mode: WorkspaceImportMode) => void
  onCancel: () => void
}

const Dot = ({ tone }: { tone: 'new' | 'existing' }) => (
  <span
    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone === 'new' ? 'bg-emerald-400' : 'bg-amber-400'}`}
  />
)

export default function WorkspaceImportDialog({
  workspaceName,
  newCollections,
  existingCollections,
  newEnvironments,
  onImport,
  onCancel
}: WorkspaceImportDialogProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  const hasNew = newCollections.length > 0 || newEnvironments.length > 0
  const hasExisting = existingCollections.length > 0

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
      onMouseDown={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-xl border border-studio-border bg-studio-elevated shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-studio-border px-5 py-3.5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-studio-text">
              <Upload className="h-4 w-4 text-studio-muted" />
              Import workspace
            </h2>
            <p className="mt-1 text-xs text-studio-muted">
              Dari <span className="text-studio-text">{workspaceName}</span>
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onCancel} title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-studio-border bg-studio-panel/60 px-3 py-2">
              <div className="font-mono text-lg text-emerald-400">{newCollections.length}</div>
              <div className="text-2xs text-studio-faint">collection baru</div>
            </div>
            <div className="rounded-lg border border-studio-border bg-studio-panel/60 px-3 py-2">
              <div className="font-mono text-lg text-amber-400">{existingCollections.length}</div>
              <div className="text-2xs text-studio-faint">sudah ada</div>
            </div>
            <div className="rounded-lg border border-studio-border bg-studio-panel/60 px-3 py-2">
              <div className="font-mono text-lg text-sky-400">{newEnvironments.length}</div>
              <div className="text-2xs text-studio-faint">environment baru</div>
            </div>
          </div>

          {(newCollections.length > 0 || existingCollections.length > 0) && (
            <div className="studio-scroll max-h-44 space-y-1 overflow-auto rounded-lg border border-studio-border bg-studio-panel/40 p-2">
              {newCollections.map((name) => (
                <div key={`new-${name}`} className="flex items-start gap-2 rounded-md px-1.5 py-1 text-xs">
                  <Dot tone="new" />
                  <span className="min-w-0 flex-1 truncate text-studio-text">{name}</span>
                  <span className="text-2xs text-emerald-400">baru</span>
                </div>
              ))}
              {existingCollections.map((name) => (
                <div key={`existing-${name}`} className="flex items-start gap-2 rounded-md px-1.5 py-1 text-xs">
                  <Dot tone="existing" />
                  <span className="min-w-0 flex-1 truncate text-studio-muted">{name}</span>
                  <span className="text-2xs text-amber-400">sudah ada</span>
                </div>
              ))}
            </div>
          )}

          {hasExisting && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5">
              <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <p className="text-2xs leading-relaxed text-amber-200/80">
                <span className="font-medium text-amber-300">Replace existing</span> akan menimpa request di collection
                dengan nama yang sama dan tetap menambahkan collection baru. Collection lain tidak berubah.
                {hasNew && (
                  <>
                    {' '}
                    Pilih <span className="font-medium">Add new only</span> kalau ingin mempertahankan versi sekarang.
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-studio-border px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            title="Cancel the import"
            className="btn border border-studio-border text-xs text-studio-muted hover:bg-studio-strong/50 hover:text-studio-text"
          >
            Cancel
          </button>

          {hasNew && (
            <button
              type="button"
              onClick={() => onImport('merge')}
              title="Add collections that are not in this workspace yet"
              className={`btn text-xs ${
                hasExisting
                  ? 'border border-studio-border text-studio-muted hover:bg-studio-strong/50 hover:text-studio-text'
                  : 'bg-studio-accent text-white hover:bg-blue-500'
              }`}
            >
              {hasExisting ? 'Add new only' : 'Import'}
            </button>
          )}

          {hasExisting && (
            <button
              type="button"
              onClick={() => onImport('replace')}
              title="Replace the local collections with the imported ones"
              className="btn bg-amber-500 text-xs text-studio-bg hover:bg-amber-400"
            >
              Replace existing ({existingCollections.length})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
