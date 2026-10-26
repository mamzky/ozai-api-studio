-- Scope studio_workspace & studio_commits per project (`id_project`).
--
-- Sebelumnya tabel hanya menampung satu workspace global (`id = 'default'`).
-- Sekarang satu database Supabase bisa menampung banyak project, misalnya
-- `bca-cmnv` dan `pakuwon-phase-5`, masing-masing satu baris di
-- `studio_workspace` dan riwayat commit sendiri.
--
-- Baris lama dinamai `'default'`. Setelah migrasi, upload ulang dari app
-- memakai slug project yang benar, lalu hapus baris `'default'` kalau tidak
-- dipakai lagi:
--   delete from studio_workspace where id_project = 'default';
--   delete from studio_commits where id_project = 'default';

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

-- Migrasi tabel lama yang masih memakai primary key `id`.
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

-- Desktop app memakai role Postgres dan Edge Function memakai service role.
-- Keduanya bypass RLS; role anon tidak boleh membaca/menulis langsung.
alter table studio_workspace enable row level security;
alter table studio_commits enable row level security;

create index if not exists studio_workspace_updated_at_idx
  on studio_workspace (updated_at desc);
create index if not exists studio_commits_created_at_idx
  on studio_commits (created_at desc);
create index if not exists studio_commits_project_idx
  on studio_commits (id_project, created_at desc);
