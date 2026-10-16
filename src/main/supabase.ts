import { Client, type ClientConfig } from 'pg'
import type {
  RemoteCommit,
  SyncCommitsResult,
  SyncError,
  SyncPullResult,
  SyncUploadResult,
  WorkspaceSnapshot
} from '@shared/types'

const SSL_CONFIG = { rejectUnauthorized: false }
const WORKSPACE_ID = 'default'
const CONNECT_TIMEOUT = 12000

const POOLER_REGIONS = [
  'aws-0-ap-south-1',
  'aws-1-ap-south-1',
  'aws-0-ap-southeast-1',
  'aws-1-ap-southeast-1',
  'aws-0-ap-southeast-2',
  'aws-1-ap-southeast-2',
  'aws-0-ap-northeast-1',
  'aws-1-ap-northeast-1',
  'aws-0-ap-northeast-2',
  'aws-0-us-east-1',
  'aws-1-us-east-1',
  'aws-0-us-east-2',
  'aws-0-us-west-1',
  'aws-1-us-west-1',
  'aws-0-us-west-2',
  'aws-0-eu-central-1',
  'aws-1-eu-central-1',
  'aws-0-eu-west-1',
  'aws-1-eu-west-1',
  'aws-0-eu-west-2',
  'aws-0-eu-west-3',
  'aws-0-eu-north-1',
  'aws-0-sa-east-1',
  'aws-0-ca-central-1'
]

const workingCache = new Map<string, { host: string; port: number; user: string }>()

function parseRef(input: string): string {
  const value = (input || '').trim()
  if (!value) throw new Error('Supabase URL kosong.')
  const ref = value
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/\.supabase\.(co|in|net).*$/i, '')
    .trim()
  if (!ref || !/^[a-z0-9-]+$/i.test(ref)) {
    throw new Error('URL Supabase tidak valid. Contoh: https://abcdefgh.supabase.co')
  }
  return ref
}

export function buildConnectionConfig(input: string, password: string): ClientConfig {
  const value = (input || '').trim()
  if (!value) throw new Error('Supabase URL kosong.')

  if (value.startsWith('postgres://') || value.startsWith('postgresql://')) {
    const url = new URL(value)
    return {
      host: url.hostname,
      port: Number(url.port || 5432),
      user: decodeURIComponent(url.username || 'postgres'),
      password: password || decodeURIComponent(url.password || ''),
      database: url.pathname.replace(/^\//, '') || 'postgres',
      ssl: SSL_CONFIG,
      connectionTimeoutMillis: CONNECT_TIMEOUT
    }
  }

  const ref = parseRef(value)
  return {
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: 'postgres',
    password,
    database: 'postgres',
    ssl: SSL_CONFIG,
    connectionTimeoutMillis: CONNECT_TIMEOUT
  }
}

function candidateConfigs(input: string, password: string): ClientConfig[] {
  const value = (input || '').trim()
  if (value.startsWith('postgres://') || value.startsWith('postgresql://')) {
    return [buildConnectionConfig(value, password)]
  }

  const ref = parseRef(value)
  const base: ClientConfig = {
    port: 5432,
    password,
    database: 'postgres',
    ssl: SSL_CONFIG,
    connectionTimeoutMillis: CONNECT_TIMEOUT
  }

  const configs: ClientConfig[] = []
  const cached = workingCache.get(ref)
  if (cached) configs.push({ ...base, host: cached.host, port: cached.port, user: cached.user })

  if (!cached || cached.host !== `db.${ref}.supabase.co`) {
    configs.push({ ...base, host: `db.${ref}.supabase.co`, user: 'postgres' })
  }

  for (const region of POOLER_REGIONS) {
    const host = `${region}.pooler.supabase.com`
    if (cached && cached.host === host) continue
    configs.push({ ...base, host, user: `postgres.${ref}` })
  }

  return configs
}

async function connectFirst(configs: ClientConfig[], ref: string | null): Promise<Client> {
  let lastError: unknown

  for (const config of configs) {
    const client = new Client(config)
    try {
      await client.connect()
      if (ref) workingCache.set(ref, { host: config.host!, port: config.port!, user: config.user! })
      return client
    } catch (error) {
      lastError = error
      await client.end().catch(() => undefined)
      const code = (error as { code?: string })?.code
      if (code === '28P01' || code === '28000') throw error
    }
  }

  throw lastError
}

const SCHEMA_SQL = `
create table if not exists studio_workspace (
  id text primary key,
  schema_version integer not null default 1,
  updated_at timestamptz not null default now(),
  author text,
  data jsonb not null
);
create table if not exists studio_commits (
  id bigserial primary key,
  message text,
  author text,
  created_at timestamptz not null default now(),
  data jsonb not null
);
`

function classifyError(error: unknown): { code: 'offline' | 'auth' | 'invalid' | 'unknown'; message: string } {
  const err = error as { code?: string; message?: string }
  const code = err?.code ?? ''
  const raw = err?.message ?? 'Unknown error'
  const withCode = (message: string): string => (code ? `${message} (${code})` : message)

  if (['28P01', '28000', '08P01'].includes(code)) {
    return { code: 'auth', message: withCode('Password database salah.') }
  }
  if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH', 'EAI_AGAIN', 'ECONNRESET'].includes(code)) {
    return { code: 'offline', message: withCode('Cannot sync at the moment. Tidak bisa menjangkau database Supabase.') }
  }
  if (code === 'XX000' && /not found/i.test(raw)) {
    return { code: 'invalid', message: `Project tidak ditemukan di pooler. (${raw})` }
  }
  if (/timeout|getaddrinfo|connect/i.test(raw)) {
    return { code: 'offline', message: withCode('Cannot sync at the moment. Tidak bisa menjangkau database Supabase.') }
  }
  return { code: 'unknown', message: raw }
}

function toSyncError(error: unknown, url: string): SyncError {
  const classified = classifyError(error)
  const isConnString = url.trim().toLowerCase().startsWith('postgres')
  if (classified.code === 'offline' && !isConnString) {
    return {
      ok: false,
      code: 'offline',
      error:
        `${classified.message}\n\nKalau tetap gagal, ambil connection string "Session pooler" ` +
        `(Supabase → Settings → Database → Connection string) lalu paste di field URL.`
    }
  }
  return { ok: false, code: classified.code, error: classified.message }
}

async function withClient<T>(
  url: string,
  password: string,
  run: (client: Client) => Promise<T>
): Promise<T> {
  const configs = candidateConfigs(url, password)
  const ref = url.trim().toLowerCase().startsWith('postgres') ? null : parseRef(url)
  const client = await connectFirst(configs, ref)
  try {
    return await run(client)
  } finally {
    await client.end().catch(() => undefined)
  }
}

export async function uploadWorkspace(
  url: string,
  password: string,
  author: string,
  message: string,
  snapshot: WorkspaceSnapshot
): Promise<SyncUploadResult> {
  try {
    return await withClient(url, password, async (client) => {
      await client.query(SCHEMA_SQL)
      const data = JSON.stringify(snapshot)
      await client.query(
        `insert into studio_workspace (id, schema_version, updated_at, author, data)
         values ($1, 1, now(), $2, $3::jsonb)
         on conflict (id) do update
           set schema_version = 1, updated_at = now(), author = excluded.author, data = excluded.data`,
        [WORKSPACE_ID, author, data]
      )
      const inserted = await client.query<{ id: string }>(
        `insert into studio_commits (message, author, data) values ($1, $2, $3::jsonb) returning id`,
        [message, author, data]
      )
      return { ok: true as const, commitId: Number(inserted.rows[0]?.id ?? 0) }
    })
  } catch (error) {
    return toSyncError(error, url)
  }
}

export async function pullWorkspace(url: string, password: string): Promise<SyncPullResult> {
  try {
    return await withClient(url, password, async (client) => {
      await client.query(SCHEMA_SQL)
      const result = await client.query<{ data: WorkspaceSnapshot; updated_at: string; author: string | null }>(
        `select data, updated_at, author from studio_workspace where id = $1`,
        [WORKSPACE_ID]
      )
      if (result.rows.length === 0) {
        return { ok: false as const, code: 'invalid' as const, error: 'Belum ada workspace yang di-upload ke Supabase ini.' }
      }
      const row = result.rows[0]
      return {
        ok: true as const,
        snapshot: row.data,
        updatedAt: new Date(row.updated_at).toISOString(),
        author: row.author ?? 'unknown'
      }
    })
  } catch (error) {
    return toSyncError(error, url)
  }
}

export async function listCommits(url: string, password: string, limit = 50): Promise<SyncCommitsResult> {
  try {
    return await withClient(url, password, async (client) => {
      await client.query(SCHEMA_SQL)
      const result = await client.query<{ id: string; message: string | null; author: string | null; created_at: string }>(
        `select id, message, author, created_at from studio_commits order by id desc limit $1`,
        [limit]
      )
      const commits: RemoteCommit[] = result.rows.map((row) => ({
        id: Number(row.id),
        message: row.message ?? '',
        author: row.author ?? 'unknown',
        createdAt: new Date(row.created_at).toISOString()
      }))
      return { ok: true as const, commits }
    })
  } catch (error) {
    return toSyncError(error, url)
  }
}

export async function testConnection(url: string, password: string): Promise<{ ok: true } | SyncError> {
  try {
    return await withClient(url, password, async (client) => {
      await client.query('select 1')
      return { ok: true as const }
    })
  } catch (error) {
    return toSyncError(error, url)
  }
}
