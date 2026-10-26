import { useState } from 'react'
import ParamsEditor from './ParamsEditor'
import AuthEditor from './AuthEditor'
import HeadersEditor from './HeadersEditor'
import BodyEditor from './BodyEditor'
import type { ApiRequest, EnvVariable } from '../types/api'

type EditorTab = 'params' | 'auth' | 'headers' | 'body'

interface RequestTabsProps {
  request: ApiRequest
  onChange: (patch: Partial<ApiRequest>) => void
  environmentVariables: EnvVariable[]
}

export default function RequestTabs({ request, onChange, environmentVariables }: RequestTabsProps) {
  const [active, setActive] = useState<EditorTab>('params')

  const tabs: { id: EditorTab; label: string; count?: number }[] = [
    { id: 'params', label: 'Params', count: request.params.length },
    { id: 'auth', label: 'Authorization' },
    { id: 'headers', label: 'Headers', count: request.headers.length },
    { id: 'body', label: 'Body' }
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-studio-border bg-studio-panel/40 px-3">
        {tabs.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              title={
                tab.id === 'params'
                  ? 'Edit query parameters'
                  : tab.id === 'auth'
                    ? 'Configure authorization for this request'
                    : tab.id === 'headers'
                      ? 'Edit request headers'
                      : 'Edit the request body'
              }
              className={`relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
                isActive ? 'text-studio-text' : 'text-studio-muted hover:text-studio-text'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="rounded-full bg-studio-strong/70 px-1.5 text-2xs text-studio-muted">{tab.count}</span>
              )}
              {isActive && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-studio-accent" />}
            </button>
          )
        })}
      </div>

      <div className="studio-scroll min-h-0 flex-1 overflow-auto">
        {active === 'params' && <ParamsEditor params={request.params} onChange={(params) => onChange({ params })} />}
        {active === 'auth' && (
          <AuthEditor auth={request.auth} onChange={(auth) => onChange({ auth })} variables={environmentVariables} />
        )}
        {active === 'headers' && (
          <HeadersEditor headers={request.headers} onChange={(headers) => onChange({ headers })} />
        )}
        {active === 'body' && (
          <div className="h-full">
            <BodyEditor body={request.body} onChange={(body) => onChange({ body })} />
          </div>
        )}
      </div>
    </div>
  )
}
