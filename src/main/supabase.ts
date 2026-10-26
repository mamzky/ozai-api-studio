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
const CONNECT_TIMEOUT = 5000
const CONNECT_CONCURRENCY = 10
const PROJECT_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/

const POOLER_PREFIXES = ['aws-0', 'aws-1']

// Region pooler Supabase. Host yang tidak ada gagal cepat (NXDOMAIN),
// jadi aman discan paralel.
const POOLER_REGIONS = [
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-central-1',
  'eu-central-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
  'sa-east-1',
  'ca-central-1'
]

const workingCache = new Map<string, { host: string; port: number; user: string }>()

type FailureKind = 'auth' | 'notfound' | 'network' | 'other'

interface AttemptFailure {
  config: ClientConfig
  error: unknown
  kind: FailureKind
}

class SyncConnectError extends Error {
  readonly syncCode: 'offline' | 'auth' | 'invalid' | 'unknown'
  /** Kalau diisi, error berasal dari input field ini (bukan dari koneksi). */
  readonly field?: 'project'

  constructor(syncCode: 'offline' | 'auth' | 'invalid' | 'unknown', message: string, field?: 'project') {
    super(message)
    this.name = 'SyncConnectError'
    this.syncCode = syncCode
    this.field = field
  }
}

interface PoolerBase {
  password?: ClientConfig['password']
  database?: ClientConfig['database']
  ssl: typeof SSL_CONFIG
  connectionTimeoutMillis: number
}

function normalizeProject(value: string): string {
  const project = (value || '').trim().toLowerCase()
  if (!PROJECT_PATTERN.test(project)) {
    throw new SyncConnectError(
      'invalid',
      'ID project tidak valid. Pakai huruf kecil, angka, titik, strip, atau underscore (2-64 karakter). ' +
        'Contoh: bca-cmnv, pakuwon-phase-5',
      'project'
    )
  }
  return project
}

function isConnectionString(value: string): boolean {
  return /^postgres(ql)?:\/\//i.test((value || '').trim())
}

function parseRef(input: string): string {
  const value = (input || '').trim()
  if (!value) throw new Error('Supabase URL kosong.')
  const ref = value
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/^[^@/]*@/, '')
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, '')
    .replace(/\.supabase\.(co|in|net).*$/i, '')
    .replace(/^db\./i, '')
    .trim()
    .toLowerCase()
  if (!ref || !/^[a-z0-9-]+$/.test(ref)) {
    throw new Error('URL Supabase tidak valid. Contoh: https://abcdefgh.supabase.co')
  }
  return ref
}

interface ConnectionParts {
  config: ClientConfig
  ref: string | null
  kind: 'direct' | 'pooler' | 'other'
}

function parseConnectionString(value: string, password: string): ConnectionParts {
  const url = new URL(value)
  const host = url.hostname
  const user = decodeURIComponent(url.username || 'postgres')
  const config: ClientConfig = {
    host,
    port: Number(url.port || 5432),
    user,
    password: password || decodeURIComponent(url.password || ''),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')) || 'postgres',
    ssl: SSL_CONFIG,
    connectionTimeoutMillis: CONNECT_TIMEOUT
  }

  const direct = host.match(/^db\.([a-z0-9-]+)\.supabase\.(co|in|net)$/i)
  const pooler = host.match(/^([a-z0-9-]+)\.pooler\.supabase\.com$/i)

  let ref: string | null = direct?.[1]?.toLowerCase() ?? null
  if (!ref && pooler && /^postgres\.[a-z0-9-]+$/i.test(user)) ref = user.split('.')[1].toLowerCase()

  const kind: ConnectionParts['kind'] = direct ? 'direct' : pooler ? 'pooler' : 'other'
  return { config, ref, kind }
}

export function buildConnectionConfig(input: string, password: string): ClientConfig {
  const value = (input || '').trim()
  if (!value) throw new Error('Supabase URL kosong.')

  if (isConnectionString(value)) {
    return parseConnectionString(value, password).config
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

function poolerConfigs(ref: string, base: PoolerBase, preferredHost?: string): ClientConfig[] {
  const configs: ClientConfig[] = []
  const seen = new Set<string>()
  const user = `postgres.${ref}`

  const push = (host: string) => {
    const key = `${host}|${user}`
    if (seen.has(key)) return
    seen.add(key)
    configs.push({ ...base, host, port: 5432, user })
  }

  if (preferredHost) push(preferredHost)
  for (const prefix of POOLER_PREFIXES) {
    for (const region of POOLER_REGIONS) push(`${prefix}-${region}.pooler.supabase.com`)
  }
  return configs
}

function dedupe(configs: ClientConfig[]): ClientConfig[] {
  const seen = new Set<string>()
  return configs.filter((config) => {
    const key = `${config.host}|${config.port}|${config.user}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function candidateConfigs(input: string, password: string): { configs: ClientConfig[]; ref: string | null } {
  const value = (input || '').trim()
  if (!value) throw new Error('Supabase URL kosong.')

  if (isConnectionString(value)) {
    const parsed = parseConnectionString(value, password)
    const configs: ClientConfig[] = [parsed.config]
    const ref = parsed.ref

    if (ref) {
      const base: PoolerBase = {
        password: parsed.config.password,
        database: parsed.config.database,
        ssl: SSL_CONFIG,
        connectionTimeoutMillis: CONNECT_TIMEOUT
      }
      const cached = workingCache.get(ref)
      if (cached) configs.push({ ...base, ...cached })

      const expectedUser = `postgres.${ref}`
      const userIsDefault = parsed.config.user === 'postgres' || parsed.config.user === expectedUser
      // Direct host Supabase hanya IPv6. Kalau jaringan tidak punya IPv6,
      // langsung fallback ke pooler yang tetap IPv4.
      if (userIsDefault && (parsed.kind === 'direct' || parsed.kind === 'pooler')) {
        configs.push(...poolerConfigs(ref, base, parsed.kind === 'pooler' ? parsed.config.host : undefined))
      }
    }

    return { configs: dedupe(configs), ref }
  }

  const ref = parseRef(value)
  const base: PoolerBase = {
    password,
    database: 'postgres',
    ssl: SSL_CONFIG,
    connectionTimeoutMillis: CONNECT_TIMEOUT
  }

  const configs: ClientConfig[] = []
  const cached = workingCache.get(ref)
  if (cached) configs.push({ ...base, ...cached })
  configs.push({ ...base, host: `db.${ref}.supabase.co`, port: 5432, user: 'postgres' })
  configs.push(...poolerConfigs(ref, base))

  return { configs: dedupe(configs), ref }
}

function failureKind(error: unknown): FailureKind {
  const err = error as { code?: string; message?: string }
  const code = err?.code ?? ''
  const raw = err?.message ?? ''

  if (['28P01', '28000', '08P01'].includes(code)) return 'auth'
  if (code === 'XX000' && /not found|tenant/i.test(raw)) return 'notfound'
  if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH', 'EAI_AGAIN', 'ECONNRESET', 'EPIPE'].includes(code)) {
    return 'network'
  }
  if (/timeout|getaddrinfo|network|socket|connect/i.test(raw)) return 'network'
  return 'other'
}

function errorCode(error: unknown): string {
  return (error as { code?: string })?.code ?? ''
}

function errorMessage(error: unknown): string {
  return (error as { message?: string })?.message ?? 'Unknown error'
}

function buildConnectError(failures: AttemptFailure[]): SyncConnectError {
  if (failures.length === 0) {
    return new SyncConnectError('unknown', 'Tidak ada endpoint database yang bisa dicoba.')
  }

  const auth = failures.find((item) => item.kind === 'auth')
  if (auth) return new SyncConnectError('auth', `Password database salah. (${errorCode(auth.error) || '28P01'})`)

  const notFound = failures.find((item) => item.kind === 'notfound')
  if (notFound) {
    return new SyncConnectError(
      'invalid',
      `Project Supabase tidak ditemukan di pooler (${failures.length} endpoint dicoba). ` +
        'Cek lagi project ref/URL-nya.'
    )
  }

  const network = failures.find((item) => item.kind === 'network')
  if (network) {
    const code = errorCode(network.error)
    const detail = code ? ` (${code})` : ''
    const directFailed = failures.some(
      (item) => item.kind === 'network' && /^db\./i.test(item.config.host ?? '')
    )
    const ipv6Note = directFailed
      ? '\n\nKoneksi langsung db.<project>.supabase.co hanya tersedia lewat IPv6, dan jaringan ini belum punya route IPv6.'
      : ''
    return new SyncConnectError(
      'offline',
      `Cannot sync at the moment. Tidak bisa menjangkau database Supabase${detail} (${failures.length} endpoint dicoba).` +
        ipv6Note
    )
  }

  const other = failures[0]
  return new SyncConnectError('unknown', errorMessage(other.error))
}

async function connectFirst(configs: ClientConfig[], ref: string | null): Promise<Client> {
  let next = 0
  const state: { client: Client | null; config: ClientConfig | null } = { client: null, config: null }
  const failures: AttemptFailure[] = []

  const worker = async (): Promise<void> => {
    while (!state.client) {
      const index = next++
      if (index >= configs.length) return
      const config = configs[index]
      const client = new Client(config)
      try {
        await client.connect()
        if (state.client) {
          await client.end().catch(() => undefined)
          return
        }
        state.client = client
        state.config = config
        return
      } catch (error) {
        await client.end().catch(() => undefined)
        const failure: AttemptFailure = { config, error, kind: failureKind(error) }
        failures.push(failure)
        // Password salah sudah pasti, tidak perlu lanjut scan region.
        if (failure.kind === 'auth') {
          next = configs.length
          return
        }
      }
    }
  }

  const workers = Math.min(CONNECT_CONCURRENCY, configs.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))

  if (state.client) {
    const { host, port, user } = state.config ?? {}
    if (ref && host && port && user && typeof user === 'string') {
      workingCache.set(ref, { host, port, user })
    }
    return state.client
  }

  throw buildConnectError(failures)
}

const SCHEMA_SQL = `
create table if not exists studio_workspace (
  id_project text primary key,
  schema_version integer not null default 1,
  updated_at timestamptz not null default now(),
  author text,
  data jsonb not null
);
create table if not exists studio_commits (
  id bigserial primary key,
  id_project text not null,
  message text,
  author text,
  created_at timestamptz not null default now(),
  data jsonb not null
);

-- Migrasi dari skema lama: satu workspace global dengan primary key \`id\`.
-- Baris lama dinamai 'default'; upload ulang dengan slug project yang benar.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'studio_workspace'
      and column_name = 'id'
  ) then
    alter table studio_workspace add column if not exists id_project text;
    update studio_workspace set id_project = id where id_project is null;
    alter table studio_workspace drop constraint if exists studio_workspace_pkey;
    alter table studio_workspace alter column id_project set not null;
    alter table studio_workspace add primary key (id_project);
    alter table studio_workspace drop column id;
  end if;
end $$;

alter table studio_commits add column if not exists id_project text;
update studio_commits set id_project = 'default' where id_project is null;
alter table studio_commits alter column id_project set not null;

alter table studio_workspace enable row level security;
alter table studio_commits enable row level security;
create index if not exists studio_workspace_updated_at_idx on studio_workspace (updated_at desc);
create index if not exists studio_commits_created_at_idx on studio_commits (created_at desc);
create index if not exists studio_commits_project_idx on studio_commits (id_project, created_at desc);
`

function classifyError(error: unknown): { code: 'offline' | 'auth' | 'invalid' | 'unknown'; message: string } {
  if (error instanceof SyncConnectError) {
    return { code: error.syncCode, message: error.message }
  }

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

function isSupabaseInput(input: string): boolean {
  const value = (input || '').trim().toLowerCase()
  if (!isConnectionString(value)) return true
  return /\.supabase\.(co|in|net)[:/]/.test(value) || /\.pooler\.supabase\.com[:/]/.test(value)
}

function toSyncError(error: unknown, url: string): SyncError {
  const classified = classifyError(error)
  const isFieldError = error instanceof SyncConnectError && Boolean(error.field)
  const needsHint = !isFieldError && (classified.code === 'offline' || classified.code === 'invalid')

  if (needsHint && isSupabaseInput(url) && !classified.message.includes('Session pooler')) {
    const hint =
      'Tip: Supabase → Project Settings → Database → Connection string, pilih "Session pooler", ' +
      'lalu paste string lengkapnya ke field URL. Koneksi direct db.<project>.supabase.co hanya jalan di jaringan ber-IPv6.'
    return { ok: false, code: classified.code, error: `${classified.message}\n\n${hint}` }
  }

  return { ok: false, code: classified.code, error: classified.message }
}

async function withClient<T>(
  url: string,
  password: string,
  run: (client: Client) => Promise<T>
): Promise<T> {
  const { configs, ref } = candidateConfigs(url, password)
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
  project: string,
  snapshot: WorkspaceSnapshot
): Promise<SyncUploadResult> {
  try {
    const idProject = normalizeProject(project)
    return await withClient(url, password, async (client) => {
      await client.query(SCHEMA_SQL)
      const data = JSON.stringify(snapshot)
      await client.query(
        `insert into studio_workspace (id_project, schema_version, updated_at, author, data)
         values ($1, 1, now(), $2, $3::jsonb)
         on conflict (id_project) do update
           set schema_version = 1, updated_at = now(), author = excluded.author, data = excluded.data`,
        [idProject, author, data]
      )
      const inserted = await client.query<{ id: string }>(
        `insert into studio_commits (id_project, message, author, data) values ($1, $2, $3, $4::jsonb) returning id`,
        [idProject, message, author, data]
      )
      return { ok: true as const, commitId: Number(inserted.rows[0]?.id ?? 0) }
    })
  } catch (error) {
    return toSyncError(error, url)
  }
}

export async function pullWorkspace(url: string, password: string, project: string): Promise<SyncPullResult> {
  try {
    const idProject = normalizeProject(project)
    return await withClient(url, password, async (client) => {
      await client.query(SCHEMA_SQL)
      const result = await client.query<{ data: WorkspaceSnapshot; updated_at: string; author: string | null }>(
        `select data, updated_at, author from studio_workspace where id_project = $1`,
        [idProject]
      )
      if (result.rows.length === 0) {
        return {
          ok: false as const,
          code: 'invalid' as const,
          error: `Belum ada workspace untuk project "${idProject}" di Supabase ini. Upload dulu dari sisi yang punya datanya.`
        }
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

export async function listCommits(
  url: string,
  password: string,
  project: string,
  limit = 50
): Promise<SyncCommitsResult> {
  try {
    const idProject = normalizeProject(project)
    return await withClient(url, password, async (client) => {
      await client.query(SCHEMA_SQL)
      const result = await client.query<{ id: string; message: string | null; author: string | null; created_at: string }>(
        `select id, message, author, created_at from studio_commits
         where id_project = $1
         order by id desc
         limit $2`,
        [idProject, limit]
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
