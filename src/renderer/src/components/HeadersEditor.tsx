import KeyValueTable from './KeyValueTable'
import type { KeyValue } from '../types/api'

interface HeadersEditorProps {
  headers: KeyValue[]
  onChange: (headers: KeyValue[]) => void
}

export default function HeadersEditor({ headers, onChange }: HeadersEditorProps) {
  return (
    <div className="px-4 py-4">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-studio-text">Headers</h3>
        <p className="mt-0.5 text-xs text-studio-muted">Headers are sent with the request. Duplicate keys are allowed.</p>
      </div>
      <KeyValueTable
        rows={headers}
        onChange={onChange}
        addLabel="Add Header"
        keyPlaceholder="Header"
        valuePlaceholder="Value"
        emptyHint="No headers. Click “Add Header” to create one."
      />
    </div>
  )
}
