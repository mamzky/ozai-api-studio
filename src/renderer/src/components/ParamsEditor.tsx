import KeyValueTable from './KeyValueTable'
import type { KeyValue } from '../types/api'

interface ParamsEditorProps {
  params: KeyValue[]
  onChange: (params: KeyValue[]) => void
}

export default function ParamsEditor({ params, onChange }: ParamsEditorProps) {
  return (
    <div className="px-4 py-4">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-studio-text">Query Parameters</h3>
        <p className="mt-0.5 text-xs text-studio-muted">Values are appended to the URL as a query string.</p>
      </div>
      <KeyValueTable
        rows={params}
        onChange={onChange}
        addLabel="Add Parameter"
        keyPlaceholder="Key"
        valuePlaceholder="Value"
        descriptionPlaceholder="Description"
        showDescription
        emptyHint="No query parameters. Click “Add Parameter” to create one."
      />
    </div>
  )
}
