import type { KeyValue } from '../types/api'
import { uid } from '../lib/format'
import HighlightedInput from './HighlightedInput'
import { Plus, Trash } from './Icons'

interface KeyValueTableProps {
  rows: KeyValue[]
  onChange: (rows: KeyValue[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  descriptionPlaceholder?: string
  addLabel: string
  showDescription?: boolean
  showSecret?: boolean
  emptyHint?: string
}

export default function KeyValueTable({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  descriptionPlaceholder = 'Description',
  addLabel,
  showDescription = false,
  showSecret = false,
  emptyHint = 'No entries yet.'
}: KeyValueTableProps) {
  const columns = [
    '28px',
    showDescription ? 'minmax(0,1.1fr)' : 'minmax(0,1fr)',
    showDescription ? 'minmax(0,1.4fr)' : 'minmax(0,1.6fr)',
    ...(showDescription ? ['minmax(0,1.4fr)'] : []),
    ...(showSecret ? ['56px'] : []),
    '36px'
  ].join(' ')

  const updateRow = (id: string, patch: Partial<KeyValue>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const removeRow = (id: string) => {
    onChange(rows.filter((row) => row.id !== id))
  }

  const addRow = () => {
    onChange([...rows, { id: uid('kv'), key: '', value: '', description: '', enabled: true }])
  }

  return (
    <div className="flex flex-col">
      <div
        className="grid items-center border-b border-studio-border bg-studio-elevated/40 text-2xs uppercase tracking-wider text-studio-faint"
        style={{ gridTemplateColumns: columns }}
      >
        <div />
        <div className="px-3 py-2">{keyPlaceholder}</div>
        <div className="px-3 py-2 border-l border-studio-border">{valuePlaceholder}</div>
        {showDescription && <div className="px-3 py-2 border-l border-studio-border">{descriptionPlaceholder}</div>}
        {showSecret && <div className="px-2 py-2 text-center border-l border-studio-border">Secret</div>}
        <div />
      </div>

      {rows.length === 0 && <div className="px-4 py-6 text-sm text-studio-faint">{emptyHint}</div>}

      {rows.map((row) => (
        <div
          key={row.id}
          className="group grid items-stretch border-b border-studio-border/70 transition-colors hover:bg-studio-elevated/30"
          style={{ gridTemplateColumns: columns }}
        >
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(event) => updateRow(row.id, { enabled: event.target.checked })}
              className="h-3.5 w-3.5 cursor-pointer rounded border-studio-strong bg-transparent accent-blue-500"
            />
          </div>
          <HighlightedInput
            value={row.key}
            onValueChange={(key) => updateRow(row.id, { key })}
            placeholder={keyPlaceholder}
            containerClassName="min-w-0 h-full focus-within:bg-studio-elevated/60"
            contentClassName="px-3 py-2 text-xs"
          />
          <HighlightedInput
            value={row.value}
            onValueChange={(value) => updateRow(row.id, { value })}
            placeholder={valuePlaceholder}
            containerClassName="min-w-0 h-full border-l border-studio-border/70 focus-within:bg-studio-elevated/60"
            contentClassName="px-3 py-2 text-xs"
          />
          {showDescription && (
            <input
              value={row.description}
              onChange={(event) => updateRow(row.id, { description: event.target.value })}
              placeholder={descriptionPlaceholder}
              className="min-w-0 border-l border-studio-border/70 bg-transparent px-3 py-2 text-xs text-studio-muted outline-none placeholder:text-studio-faint focus:bg-studio-elevated/60"
            />
          )}
          {showSecret && (
            <div className="flex items-center justify-center border-l border-studio-border/70">
              <input
                type="checkbox"
                checked={Boolean(row.secret)}
                onChange={(event) => updateRow(row.id, { secret: event.target.checked })}
                title="Secret (nilai tidak di-sync)"
                className="h-3.5 w-3.5 cursor-pointer rounded border-studio-strong bg-transparent accent-amber-500"
              />
            </div>
          )}
          <div className="flex items-center justify-center">
            <button type="button" onClick={() => removeRow(row.id)} className="icon-btn opacity-0 group-hover:opacity-100" title="Remove">
              <Trash className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}

      <div className="pt-3">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-studio-muted transition-colors hover:bg-studio-strong/50 hover:text-studio-text"
        >
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
        </button>
      </div>
    </div>
  )
}
