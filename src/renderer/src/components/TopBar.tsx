import Dropdown from './Dropdown'
import { Clock, CloudDownload, CloudUpload, Globe, Search, Settings } from './Icons'
import type { Environment } from '../types/api'

interface TopBarProps {
  search: string
  onSearchChange: (value: string) => void
  breadcrumb: string
  workspace: string
  onWorkspaceChange: (value: string) => void
  environments: Environment[]
  activeEnvironmentId: string | null
  onSelectEnvironment: (id: string | null) => void
  onManageEnvironments: () => void
  onUpload: () => void
  onImport: () => void
  onHistory: () => void
}

const workspaces = [
  { value: 'My Workspace', label: 'My Workspace' },
  { value: 'Team Workspace', label: 'Team Workspace' },
  { value: 'Sandbox', label: 'Sandbox' }
]

const MANAGE_VALUE = '__manage__'

export default function TopBar({
  search,
  onSearchChange,
  breadcrumb,
  workspace,
  onWorkspaceChange,
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onManageEnvironments,
  onUpload,
  onImport,
  onHistory
}: TopBarProps) {
  const isMac = window.api?.platform === 'darwin'
  const activeEnvironment = environments.find((environment) => environment.id === activeEnvironmentId)

  const environmentOptions = [
    { value: '', label: <span className="text-studio-muted">No Environment</span> },
    ...environments.map((environment) => ({ value: environment.id, label: environment.name })),
    { value: MANAGE_VALUE, label: <span className="text-studio-faint">Manage Environments…</span> }
  ]

  return (
    <header className="drag flex h-12 shrink-0 items-center gap-3 border-b border-studio-border bg-studio-sidebar px-4">
      {isMac && <div className="w-[68px] shrink-0" />}

      <div className="no-drag hidden min-w-0 items-center gap-2 md:flex">
        <span className="truncate text-sm text-studio-muted">{breadcrumb}</span>
      </div>

      <div className="no-drag relative mx-auto w-full max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-studio-faint" />
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search requests..."
          className="field h-8 w-full pl-8 text-xs"
        />
      </div>

      <div className="no-drag flex items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-md border border-studio-border bg-studio-elevated/40 p-0.5">
          <button type="button" className="icon-btn" title="Upload to Supabase" onClick={onUpload}>
            <CloudUpload className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="icon-btn" title="Import via URL" onClick={onImport}>
            <CloudDownload className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="icon-btn" title="Local history" onClick={onHistory}>
            <Clock className="h-3.5 w-3.5" />
          </button>
        </div>

        <Dropdown
          value={activeEnvironment?.id ?? ''}
          options={environmentOptions}
          onChange={(value) => {
            if (value === MANAGE_VALUE) {
              onManageEnvironments()
              return
            }
            onSelectEnvironment(value || null)
          }}
          renderValue={() => (
            <span className="flex items-center gap-2 text-xs">
              <Globe className={`h-3.5 w-3.5 ${activeEnvironment ? 'text-emerald-400' : 'text-studio-faint'}`} />
              <span className={activeEnvironment ? 'text-studio-text' : 'text-studio-muted'}>
                {activeEnvironment?.name ?? 'No Environment'}
              </span>
            </span>
          )}
          triggerClassName="field flex h-8 items-center gap-2 px-2.5 text-xs"
          menuClassName="absolute right-0 z-30 mt-1 w-[200px] rounded-lg border border-studio-border bg-studio-elevated p-1 shadow-panel"
        />

        <Dropdown
          value={workspace}
          options={workspaces}
          onChange={onWorkspaceChange}
          triggerClassName="field flex h-8 items-center gap-2 px-2.5 text-xs text-studio-muted"
        />

        <button type="button" className="icon-btn" title="Manage Environments" onClick={onManageEnvironments}>
          <Settings />
        </button>
      </div>
    </header>
  )
}
