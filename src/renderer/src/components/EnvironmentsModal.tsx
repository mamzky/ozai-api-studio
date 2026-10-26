import { useEffect, useMemo, useState } from 'react'
import KeyValueTable from './KeyValueTable'
import { Plus, Trash } from './Icons'
import { createEnvironment } from '../data/defaultData'
import type { Environment } from '../types/api'

interface EnvironmentsModalProps {
  environments: Environment[]
  activeEnvironmentId: string | null
  onChange: (environments: Environment[]) => void
  onSelectActive: (id: string) => void
  onClose: () => void
}

export default function EnvironmentsModal({
  environments,
  activeEnvironmentId,
  onChange,
  onSelectActive,
  onClose
}: EnvironmentsModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    activeEnvironmentId ?? environments[0]?.id ?? null
  )

  useEffect(() => {
    if (!environments.some((environment) => environment.id === selectedId)) {
      setSelectedId(activeEnvironmentId ?? environments[0]?.id ?? null)
    }
  }, [environments, activeEnvironmentId, selectedId])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const selected = useMemo(
    () => environments.find((environment) => environment.id === selectedId) ?? null,
    [environments, selectedId]
  )

  const patchEnvironment = (id: string, patch: Partial<Environment>) => {
    onChange(environments.map((environment) => (environment.id === id ? { ...environment, ...patch } : environment)))
  }

  const addEnvironment = () => {
    const environment = createEnvironment()
    onChange([...environments, environment])
    setSelectedId(environment.id)
  }

  const deleteEnvironment = (id: string) => {
    const next = environments.filter((environment) => environment.id !== id)
    onChange(next)
    if (activeEnvironmentId === id) onSelectActive(next[0]?.id ?? '')
    setSelectedId(next[0]?.id ?? null)
  }

  return (
    <div
      className="fixed inset-0 z-[55] grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="flex h-[520px] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-studio-border bg-studio-panel shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-studio-border px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-studio-text">Environments</h2>
            <p className="mt-0.5 text-xs text-studio-muted">
              Use variables in requests with{' '}
              <span className="font-mono text-studio-faint">{'{{base_url}}'}</span> or{' '}
              <span className="font-mono text-studio-faint">{'<<base_url>>'}</span>. Token example:{' '}
              <span className="font-mono text-studio-faint">{'<<token>>'}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close the environments manager"
            className="btn border border-studio-border text-studio-muted hover:bg-studio-strong/50 hover:text-studio-text"
          >
            Done
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex w-[220px] shrink-0 flex-col border-r border-studio-border bg-studio-sidebar/60">
            <div className="studio-scroll flex-1 overflow-y-auto p-2">
              {environments.map((environment) => {
                const isSelected = environment.id === selectedId
                const isActive = environment.id === activeEnvironmentId
                return (
                  <div
                    key={environment.id}
                    className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                      isSelected ? 'bg-studio-accent/15 text-studio-text' : 'text-studio-muted hover:bg-studio-strong/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(environment.id)}
                      title={`Open ${environment.name || 'this environment'}`}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-studio-strong'}`}
                      />
                      <span className="truncate">{environment.name || 'Untitled'}</span>
                    </button>
                    {isActive ? (
                      <span className="text-2xs font-medium text-emerald-400">active</span>
                    ) : (
                      <button
                        type="button"
                        title="Set active"
                        onClick={() => onSelectActive(environment.id)}
                        className="text-2xs text-studio-faint opacity-0 transition-opacity hover:text-studio-text group-hover:opacity-100"
                      >
                        use
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="border-t border-studio-border p-2">
              <button
                type="button"
                onClick={addEnvironment}
                title="Create a new environment"
                className="btn w-full justify-center border border-dashed border-studio-strong text-studio-muted hover:border-studio-accent/50 hover:bg-studio-strong/40 hover:text-studio-text"
              >
                <Plus className="h-3.5 w-3.5" />
                New Environment
              </button>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            {selected ? (
              <>
                <div className="flex items-center gap-2 border-b border-studio-border px-4 py-3">
                  <input
                    value={selected.name}
                    onChange={(event) => patchEnvironment(selected.id, { name: event.target.value })}
                    placeholder="Environment name"
                    className="field h-8 flex-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => deleteEnvironment(selected.id)}
                    title="Delete environment"
                    className="icon-btn text-red-400 hover:bg-red-500/15 hover:text-red-300"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="studio-scroll min-h-0 flex-1 overflow-auto px-4 py-4">
                  <KeyValueTable
                    rows={selected.variables}
                    onChange={(variables) => patchEnvironment(selected.id, { variables })}
                    addLabel="Add Variable"
                    keyPlaceholder="Variable"
                    valuePlaceholder="Value"
                    showSecret
                    emptyHint="No variables yet. Add base_url, token, or any custom variable."
                  />
                </div>
              </>
            ) : (
              <div className="grid flex-1 place-items-center text-sm text-studio-faint">
                No environment selected.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
