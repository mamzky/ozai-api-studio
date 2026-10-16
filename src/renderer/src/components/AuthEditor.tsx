import Dropdown from './Dropdown'
import type { AuthConfig, AuthType, EnvVariable } from '../types/api'

interface AuthEditorProps {
  auth: AuthConfig
  onChange: (auth: AuthConfig) => void
  variables: EnvVariable[]
}

const authTypes: { value: AuthType; label: string }[] = [
  { value: 'none', label: 'No Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'api-key', label: 'API Key' }
]

const inputClass = 'field w-full font-mono text-xs'

const TOKEN_VARIABLE_REGEX = /^\s*\{\{\s*([\w.-]+)\s*\}\}\s*$|^\s*<<\s*([\w.-]+)\s*>>\s*$/

export default function AuthEditor({ auth, onChange, variables }: AuthEditorProps) {
  const patch = (partial: Partial<AuthConfig>) => onChange({ ...auth, ...partial })

  const tokenMatch = auth.token.match(TOKEN_VARIABLE_REGEX)
  const tokenInVariableMode = Boolean(tokenMatch)
  const tokenVariableKey = tokenMatch ? (tokenMatch[1] ?? tokenMatch[2] ?? '') : ''

  const availableVariables = variables.filter((variable) => variable.key.trim())

  const switchTokenMode = (mode: 'variables' | 'custom') => {
    if (mode === 'variables') {
      if (!tokenInVariableMode) {
        const first = availableVariables.find((variable) => variable.enabled) ?? availableVariables[0]
        patch({ token: first ? `{{${first.key.trim()}}}` : '' })
      }
    } else if (tokenInVariableMode) {
      patch({ token: '' })
    }
  }

  return (
    <div className="max-w-xl px-4 py-4">
      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-studio-text">Auth Type</label>
        <Dropdown
          value={auth.type}
          options={authTypes}
          onChange={(value) => patch({ type: value as AuthType })}
          triggerClassName="field flex h-9 w-full items-center justify-between gap-2 text-sm"
          menuClassName="absolute z-30 mt-1 w-full rounded-lg border border-studio-border bg-studio-elevated p-1 shadow-panel"
        />
      </div>

      {auth.type === 'none' && (
        <div className="rounded-lg border border-studio-border bg-studio-elevated/40 px-3 py-2.5 text-xs text-studio-muted">
          This request does not use any authorization.
        </div>
      )}

      {auth.type === 'bearer' && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-studio-text">Token</label>
            <div className="inline-flex items-center gap-1 rounded-lg border border-studio-border bg-studio-elevated/50 p-0.5">
              <button
                type="button"
                onClick={() => switchTokenMode('variables')}
                className={`rounded-md px-2.5 py-1 text-2xs font-medium transition-colors ${
                  tokenInVariableMode
                    ? 'bg-studio-accent/20 text-studio-text ring-1 ring-inset ring-studio-accent/30'
                    : 'text-studio-muted hover:text-studio-text'
                }`}
              >
                Use Variables
              </button>
              <button
                type="button"
                onClick={() => switchTokenMode('custom')}
                className={`rounded-md px-2.5 py-1 text-2xs font-medium transition-colors ${
                  !tokenInVariableMode
                    ? 'bg-studio-accent/20 text-studio-text ring-1 ring-inset ring-studio-accent/30'
                    : 'text-studio-muted hover:text-studio-text'
                }`}
              >
                Custom Value
              </button>
            </div>
          </div>

          {tokenInVariableMode ? (
            availableVariables.length === 0 ? (
              <div className="rounded-lg border border-studio-border bg-studio-elevated/40 px-3 py-2.5 text-xs text-studio-muted">
                No variables in the active environment. Add one from <span className="text-studio-text">Manage Environments</span>.
              </div>
            ) : (
              <Dropdown
                value={tokenVariableKey}
                options={availableVariables.map((variable) => ({ value: variable.key.trim(), label: variable.key.trim() }))}
                onChange={(key) => patch({ token: `{{${key}}}` })}
                triggerClassName="field flex h-9 w-full items-center justify-between gap-2 font-mono text-xs"
                menuClassName="absolute z-30 mt-1 w-full rounded-lg border border-studio-border bg-studio-elevated p-1 shadow-panel"
              />
            )
          ) : (
            <input
              type="password"
              value={auth.token}
              onChange={(event) => patch({ token: event.target.value })}
              placeholder="Paste a token or use a variable"
              className={inputClass}
            />
          )}

          <p className="mt-2 text-xs text-studio-muted">
            Sent as{' '}
            <span className="font-mono text-studio-faint">
              Authorization: Bearer {tokenInVariableMode && tokenVariableKey ? `{{${tokenVariableKey}}}` : '<token>'}
            </span>
          </p>
        </div>
      )}

      {auth.type === 'basic' && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-studio-text">Username</label>
            <input
              value={auth.username}
              onChange={(event) => patch({ username: event.target.value })}
              placeholder="username"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-studio-text">Password</label>
            <input
              type="password"
              value={auth.password}
              onChange={(event) => patch({ password: event.target.value })}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>
        </div>
      )}

      {auth.type === 'api-key' && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-studio-text">Key</label>
            <input
              value={auth.apiKeyName}
              onChange={(event) => patch({ apiKeyName: event.target.value })}
              placeholder="X-API-Key"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-studio-text">Value</label>
            <input
              type="password"
              value={auth.apiKeyValue}
              onChange={(event) => patch({ apiKeyValue: event.target.value })}
              placeholder="{{apiKey}}"
              className={inputClass}
            />
          </div>
        </div>
      )}
    </div>
  )
}
