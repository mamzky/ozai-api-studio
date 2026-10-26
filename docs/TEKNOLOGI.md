# Teknologi Ozai API Studio

Dokumen ini menjelaskan stack, arsitektur, dan alasan di balik pilihan teknis di repo ini. Untuk cara pakai harian, lihat [`../README.md`](../README.md). Untuk aturan kerja agent, lihat [`../AGENTS.md`](../AGENTS.md).

## Ringkasan

Ozai API Studio adalah aplikasi desktop API client. Semua data tersimpan lokal, request HTTP dikirim dari proses main Electron, dan sinkronisasi workspace memakai koneksi Postgres langsung ke Supabase — tanpa backend perantara.

```text
┌──────────────────── Renderer (Chromium) ────────────────────┐
│  React 18 + TypeScript + Tailwind                            │
│  • state workspace & tab (React state, tanpa state library)   │
│  • mock transport lokal (tanpa network)                       │
└───────────────────────────┬──────────────────────────────────┘
                            │  window.api  (contextBridge)
┌───────────────────────────▼──────────────────────────────────┐
│  Preload — jembatan tipis, tanpa logika bisnis                │
└───────────────────────────┬──────────────────────────────────┘
                            │  ipcRenderer.invoke
┌───────────────────────────▼──────────────────────────────────┐
│  Main (Node.js 20)                                            │
│  • HTTP request  → fetch + AbortController                    │
│  • penyimpanan   → JSON di app.getPath('userData')            │
│  • sync          → pg (Postgres) ke Supabase                  │
└───────────────────────────────────────────────────────────────┘
```

## Stack

| Lapisan | Teknologi | Versi | Fungsi |
| --- | --- | --- | --- |
| Runtime desktop | Electron | 31.7.7 | Window, IPC, akses filesystem, network |
| Build tool | electron-vite | 2.3.0 | Bundling main/preload/renderer, HMR di dev |
| Bundler | Vite | 5.4.21 | Dev server renderer + build produksi |
| UI | React + React DOM | 18.3.1 | Seluruh antarmuka |
| Bahasa | TypeScript | 5.9.3 | `strict`, `noUnusedLocals`, `noUnusedParameters` |
| Styling | Tailwind CSS | 3.4.19 | Utility-first, token warna `studio-*` |
| CSS pipeline | PostCSS + Autoprefixer | 8.5.29 / 10.6.1 | Proses Tailwind + prefix |
| HTTP client | `fetch` bawaan Node 20 | — | Transport request di proses main |
| Driver database | `pg` (node-postgres) | 8.23.1 | Koneksi Postgres/Supabase |
| Backend | Supabase Postgres + Edge Functions | Deno + `@supabase/supabase-js@2` | Penyimpanan snapshot & mock API publik |
| Packaging | electron-builder | 26.15.3 | DMG/ZIP (macOS arm64), NSIS/ZIP (Windows x64) |
| CI/CD | GitHub Actions | — | Build + rilis otomatis saat tag `v*` |
| Ikon | `iconutil` + `.ico` | — | `build/icon.icns`, `build/icon.ico` |

Tidak ada dependency runtime selain `pg`, `react`, dan `react-dom`. Tidak ada axios, state library, router, ORM, maupun CSS framework tambahan.

## Tiga proses Electron

### Main (`src/main/`)

Proses Node penuh. Isinya:

- `index.ts` — membuat window, mendaftarkan IPC, transport HTTP, penyimpanan JSON.
- `supabase.ts` — semua urusan sync: parsing URL, pencarian endpoint pooler, upload/pull/commits.

Window dibuat dengan `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`. Renderer tidak pernah menyentuh Node, filesystem, atau database secara langsung.

### Preload (`src/preload/index.ts`)

Hanya `contextBridge.exposeInMainWorld('api', …)`. Setiap method adalah satu baris `ipcRenderer.invoke`. Tujuannya supaya permukaan API ke renderer sempit dan mudah diaudit.

### Renderer (`src/renderer/src/`)

React murni. Tidak ada router karena aplikasi ini single-window; navigasi cukup state di `App.tsx`:

- collections, request, environment, tab, panel resize, dialog
- autosave lewat hook `useAppData` (debounce 300 ms)

## Alur request

Ada dua jalur, ditentukan toggle **Mock** pada request.

```text
Mock ON   → services/mock.ts (renderer) → response palsu, tanpa IPC, tanpa network
Mock OFF  → window.api.sendRequest → IPC 'request:send' → fetch (main) → response
```

Detail penting:

- Mock dijalankan di renderer, delay buatan 220–480 ms supaya indikator loading tetap terasa nyata. Kalau request tidak punya `mockResponse`, dipakai fallback JSON generik.
- Saat `request.mock` aktif, validasi URL/JSON dilewati karena tujuannya cuma menampilkan contoh response.
- Transport asli memakai `fetch` global Node 20 dengan `AbortController`, timeout default 30 detik, `redirect: 'follow'`, dan hanya mengizinkan skema `http:`/`https:`.
- Ukuran response dihitung dari `Buffer.byteLength`, latency dari selisih timestamp sebelum/sesudah `fetch`.

## Penyimpanan lokal

| File (di `app.getPath('userData')`) | Isi |
| --- | --- |
| `api-studio.json` | `AppData`: collections, environments, activeEnvironmentId, sync (url, password, author, project) |
| `api-studio-history.json` | Riwayat upload/import lokal, maksimal 50 entri, untuk rollback |

- Ditulis lewat IPC `storage:save` dan `history:save` (proses main, `fs.promises`).
- Nama folder lama (`api-studio`) dimigrasi otomatis ke nama app saat ini.
- Kalau renderer dibuka di browser biasa (tanpa `window.api`), penyimpanan jatuh ke `localStorage` — berguna untuk screenshot/testing.

## Sync Supabase

Supabase hanyalah Postgres + Edge Function. Tidak ada server milik Ozai.

### Kenapa `pg` langsung, bukan PostgREST

Aturan arsitektur melarang menambah backend sendiri. Dengan `pg` di proses main, aplikasi bisa bicara langsung ke database memakai kredensial Postgres milik user, dan tetap kompatibel dengan Supabase.

### Cara menemukan endpoint database

Supabase punya dua jenis koneksi:

1. **Direct** — `db.<ref>.supabase.co`, hanya IPv4-mati di banyak jaringan (IPv6 only).
2. **Pooler** — `<prefix>-<region>.pooler.supabase.com`, IPv4.

Karena itu `candidateConfigs()` menyusun daftar kandidat:

- host dari connection string (jika user paste string lengkap),
- host yang pernah berhasil (cache in-memory per project ref),
- host direct,
- 2 prefix (`aws-0`, `aws-1`) × 17 region pooler = 34 kandidat.

Koneksi dicoba paralel dengan concurrency 10 dan timeout 5 detik per kandidat. Password salah (`28P01`) langsung menghentikan pencarian supaya tidak memboroskan waktu. Host yang menang disimpan di cache.

### Skema

```sql
studio_workspace  (id_project text primary key, schema_version, updated_at, author, data jsonb)
studio_commits    (id bigserial primary key, id_project text, message, author, created_at, data jsonb)
```

- Satu database bisa menampung banyak project; `id_project` adalah slug (`^[a-z0-9][a-z0-9._-]{1,63}$`).
- Snapshot yang disimpan adalah `{ collections, environments }`.
- Migrasi dijalankan idempotent setiap kali konek (`create table if not exists` + blok `do $$ … $$` untuk mengubah skema lama ber-`id` menjadi `id_project`).
- RLS aktif di kedua tabel dan **tidak ada policy publik**. Desktop memakai role Postgres; Edge Function memakai service role.
- Environment variable bertanda *secret* dikosongkan sebelum upload (`sanitizeEnvironments`).

## Hosted mock API

`supabase/functions/mock/index.ts` adalah Edge Function Deno yang membaca snapshot terbaru dan menyajikan `examples` sebagai respons HTTP nyata.

- Client: `@supabase/supabase-js@2` dengan service role (hanya di dalam function).
- Cache snapshot 5 detik per project.
- Pemilihan project: `?__project=<slug>` → `X-Ozai-Project` → secret `OZAI_DEFAULT_PROJECT` → `default` → snapshot terbaru.
- Pemilihan example: default example `2xx` terbaru; bisa `?__example=403`, `X-Ozai-Example: Forbidden case`, atau nama.
- Route matching: exact match dulu, lalu pattern dengan segmen numerik/UUID dinormalisasi menjadi `:param`. `HEAD` jatuh ke `GET`.
- Header respons: `x-ozai-mock`, `x-ozai-example`, `x-ozai-route`, `x-ozai-project`, `x-ozai-workspace-updated`; CORS terbuka.
- Autentikasi function dimatikan di gateway (`--no-verify-jwt`) dan dilakukan sendiri: `apikey` / `x-ozai-mock-key` / `Authorization: Bearer` / `?__mock_key=` dibandingkan dengan `MOCK_KEY` atau anon key.

## Build dan rilis

### Lokal

```bash
npm run build        # electron-vite build → out/
npm run package      # macOS: dmg + zip
npm run package:win  # Windows x64: NSIS + zip (bisa dari macOS)
```

electron-builder hanya membundel `out/**/*` dan `package.json`. Ikon diambil dari `build/icon.icns` (macOS) dan `build/icon.ico` (Windows).

Script `postinstall` (`scripts/fix-electron-signature.cjs`) menangani kasus macOS memblokir Electron karena sertifikat notarization dicabut: kalau `spctl` melaporkan `revoked`, Electron di-re-sign ad-hoc.

### Otomatis (GitHub Actions)

`.github/workflows/release.yml` jalan saat tag `v*` di-push atau manual:

1. Job `macos-latest` dan `windows-latest` — `npm ci`, build, `electron-builder --publish never`.
2. Upload artifact.
3. `softprops/action-gh-release` melampirkan DMG/ZIP/EXE ke release dan membuat release notes otomatis.

Build belum ditandatangani dan belum dinotarisasi, jadi macOS butuh right-click → **Open** dan Windows menampilkan SmartScreen.

## Tooling dan konvensi

- **Alias**: `@/*` → `src/renderer/src/*`, `@shared/*` → `src/shared/*` (didefinisikan di `tsconfig.json` dan `electron.vite.config.ts`).
- **Type check**: `npm run typecheck` (`tsc --noEmit`). Tidak ada linter/formatter terpisah (ESLint/Prettier) di repo ini; konsistensi dijaga manual.
- **Design token**: warna `studio-bg`, `studio-panel`, `studio-elevated`, `studio-sidebar`, `studio-border`, `studio-strong`, `studio-text`, `studio-muted`, `studio-faint`, `studio-accent`, `studio-accentSoft`; font Inter + JetBrains Mono; ukuran ekstra kecil `2xs`.
- **Tipe lintas proses**: `src/shared/types.ts`. Tipe khusus renderer: `src/renderer/src/types/api.ts`.

## Keputusan desain

| Keputusan | Alasan |
| --- | --- |
| Tanpa state library | Skala aplikasi masih wajar untuk React state + satu hook; menghindari dependency tambahan |
| Tanpa router | Single window, navigasi berbasis state |
| `fetch` bukan axios | Sudah tersedia di Node 20, cukup untuk kebutuhan |
| SQL langsung, tanpa ORM | Query sedikit dan spesifik; ORM menambah lapisan tanpa manfaat |
| Sync lewat `pg` di main | Tidak perlu backend sendiri; sesuai batas scope proyek |
| Mock di renderer | Tidak menyentuh network, cepat, aman untuk demo |
| JSON file, bukan SQLite | Data kecil, mudah di-backup/di-debug, tidak butuh native module |

## Keamanan

- Renderer terisolasi: `contextIsolation: true`, `nodeIntegration: false`.
- Service role key Supabase tidak pernah dikirim ke renderer; hanya dibaca Edge Function.
- RLS aktif tanpa policy publik pada `studio_workspace` dan `studio_commits`.
- Hanya env var yang tidak bertanda secret yang ikut ter-upload.
- Repo memakai secret scanning + push protection GitHub, dan branch `main` dilindungi ruleset (no force-push, no delete, wajib PR).
- **Catatan jujur**: password database untuk sync disimpan sebagai teks biasa di `api-studio.json` pada mesin pengguna. Belum dienkripsi dengan Keychain/DPAPI.

## Peta file penting

| Path | Isi |
| --- | --- |
| `src/main/index.ts` | Window, IPC, transport HTTP, penyimpanan JSON |
| `src/main/supabase.ts` | Koneksi Postgres, pooler scan, upload/pull/commits, skema |
| `src/preload/index.ts` | `contextBridge` → `window.api` |
| `src/renderer/src/App.tsx` | State workspace, tab, context menu, dialog |
| `src/renderer/src/components/` | UI (tree, editor, viewer, dialog) |
| `src/renderer/src/services/` | `storage.ts`, `sync.ts`, `mock.ts` |
| `src/renderer/src/lib/` | Request builder, environment, cURL, OpenAPI, format |
| `src/shared/types.ts` | Tipe lintas proses |
| `supabase/functions/mock/index.ts` | Edge Function mock API |
| `supabase/migrations/` | Skema + migrasi `id_project` |
| `build/` | Ikon aplikasi (icns/ico/png) |
| `.github/workflows/release.yml` | CI build + rilis |
