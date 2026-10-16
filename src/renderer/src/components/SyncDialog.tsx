import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SyncConnection } from '../types/api'

interface SyncDialogProps {
  mode: 'upload' | 'import'
  initial: SyncConnection | null
  onCancel: () => void
  onSubmit: (values: { url: string; password: string; author: string; message: string }) => Promise<string | null>
  onTest: (values: { url: string; password: string }) => Promise<{ ok: boolean; message: string }>
}

const inputClass = 'field w-full font-mono text-xs'
const labelClass = 'mb-1.5 block text-xs font-medium text-studio-text'

export default function SyncDialog({ mode, initial, onCancel, onSubmit, onTest }: SyncDialogProps) {
  const [url, setUrl] = useState(initial?.url ?? '')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [author, setAuthor] = useState(initial?.author ?? '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [busy, setBusy] = useState(false)
  const urlRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    urlRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [busy, onCancel])

  const isUpload = mode === 'upload'
  const isConnString = url.trim().toLowerCase().startsWith('postgres')

  const submit = async () => {
    if (!url.trim()) {
      setError('URL Supabase wajib diisi.')
      return
    }
    if (!password.trim() && !isConnString) {
      setError('DB password wajib diisi.')
      return
    }
    if (isUpload && !message.trim()) {
      setError('Commit message wajib diisi.')
      return
    }
    setBusy(true)
    setError(null)
    const result = await onSubmit({ url: url.trim(), password, author: author.trim(), message: message.trim() })
    setBusy(false)
    if (result) setError(result)
  }

  const runTest = async () => {
    if (!url.trim() || (!password.trim() && !isConnString)) {
      setTestResult({ ok: false, message: 'Isi URL dan DB password dulu.' })
      return
    }
    setTesting(true)
    setError(null)
    const result = await onTest({ url: url.trim(), password })
    setTesting(false)
    setTestResult(result)
  }

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
      onMouseDown={() => !busy && onCancel()}
    >
      <div
        className="w-full max-w-md rounded-xl border border-studio-border bg-studio-elevated p-5 shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-studio-text">
          {isUpload ? 'Upload to Supabase' : 'Import via URL'}
        </h2>
        <p className="mt-1 text-xs text-studio-muted">
          {isUpload
            ? 'Kirim workspace lokal ke Supabase project kamu.'
            : 'Tarik workspace dari Supabase project teman/kamu.'}
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className={labelClass}>Supabase URL</label>
            <input
              ref={urlRef}
              value={url}
              onChange={(event) => {
                setUrl(event.target.value)
                setTestResult(null)
              }}
              placeholder="https://xxxxxxxx.supabase.co"
              spellCheck={false}
              className={inputClass}
            />
            <p className="mt-1 text-2xs text-studio-faint">
              Boleh juga connection string lengkap (postgresql://...).
            </p>
          </div>

          <div>
            <label className={labelClass}>DB Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setTestResult(null)
              }}
              placeholder="password database project"
              className={inputClass}
            />
            <p className="mt-1 text-2xs text-studio-faint">
              Boleh dikosongkan kalau memakai connection string yang sudah memuat password.
            </p>
          </div>

          <div>
            <label className={labelClass}>Nama kamu (author)</label>
            <input
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="mis. imam"
              className={inputClass}
            />
          </div>

          {isUpload && (
            <div>
              <label className={labelClass}>Commit message</label>
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="mis. tambah endpoint roles"
                className={inputClass}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void submit()
                  }
                }}
              />
            </div>
          )}
        </div>

        {testResult && (
          <div
            className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
              testResult.ok
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/30 bg-red-500/10 text-red-300'
            }`}
          >
            {testResult.ok ? 'Koneksi berhasil. Database bisa diakses.' : testResult.message}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={runTest}
            disabled={busy || testing}
            className="btn mr-auto border border-studio-border text-studio-muted hover:bg-studio-strong/50 hover:text-studio-text disabled:opacity-50"
          >
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn border border-studio-border text-studio-muted hover:bg-studio-strong/50 hover:text-studio-text disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="btn bg-studio-accent text-white hover:bg-blue-500 disabled:opacity-70"
          >
            {busy ? (isUpload ? 'Uploading…' : 'Importing…') : isUpload ? 'Upload' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
