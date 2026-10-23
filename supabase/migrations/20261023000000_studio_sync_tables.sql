-- Sync tables used by the desktop app and the `mock` Edge Function.
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

-- The desktop app connects with the Postgres role and the Edge Function uses
-- the service role. Both bypass RLS; the public anon role should not be able
-- to read or write workspace data directly through PostgREST.
alter table studio_workspace enable row level security;
alter table studio_commits enable row level security;

create index if not exists studio_commits_created_at_idx
  on studio_commits (created_at desc);
