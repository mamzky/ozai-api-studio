import { useEffect } from 'react'
import { Trash } from './Icons'
import type { HistoryEntry } from '../types/api'

interface HistoryDialogProps {
  entries: HistoryEntry[]
  onRollback: (entry: HistoryEntry) => void
  onDelete: (id: string) => void
  onCancel: () => void
}

const formatDate = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString()
}

export default function HistoryDialog({ entries, onRollback, onDelete, onCancel }: HistoryDialogProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
      onMouseDown={onCancel}
    >
      <div
        className="flex h-[480px] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-studio-border bg-studio-panel shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-studio-border px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-studio-text">Local History</h2>
            <p className="mt-0.5 text-xs text-studio-muted">
              Snapshot yang tersimpan lokal. Rollback mengubah workspace di mesin ini saja.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="btn border border-studio-border text-studio-muted hover:bg-studio-strong/50 hover:text-studio-text"
          >
            Close
          </button>
        </div>

        <div className="studio-scroll min-h-0 flex-1 overflow-auto">
          {entries.length === 0 && (
            <div className="grid h-full place-items-center px-6 text-center text-sm text-studio-faint">
              Belum ada snapshot lokal. Upload atau Import untuk mulai menyimpan versi.
            </div>
          )}

          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 border-b border-studio-border/70 px-4 py-3 transition-colors hover:bg-studio-elevated/40"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-studio-text">{entry.message || '(no message)'}</div>
                <div className="mt-0.5 text-2xs text-studio-faint">
                  {entry.author || 'unknown'} · {formatDate(entry.createdAt)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRollback(entry)}
                className="btn border border-studio-border text-studio-muted hover:bg-studio-strong/50 hover:text-studio-text"
              >
                Rollback
              </button>
              <button
                type="button"
                title="Delete snapshot"
                onClick={() => onDelete(entry.id)}
                className="icon-btn text-red-400 hover:bg-red-500/15 hover:text-red-300"
              >
                <Trash className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
