# AGENTS.md — Ozai API Studio Desktop

Panduan kerja untuk agent di project desktop app ini.

## Ringkasan

Ozai API Studio adalah API client desktop (mirip Postman/Insomnia) untuk membuat, mengirim, dan mengelola HTTP request. Project ini adalah repo `ozai-api-studio` dan berada di folder `ozai-desktop/`.

Versi web ada di folder sibling `../ozai-project/` dan merupakan repo terpisah. Jangan mencampur kode kedua project.

## Tech stack

- Electron 31 + electron-vite
- React 18 + TypeScript
- Tailwind CSS 3
- `pg` untuk sinkronisasi workspace ke Supabase/Postgres
- Local persistence di renderer, IPC untuk HTTP request dan sync

## Command penting

Jalankan dari root `ozai-desktop/`:

```bash
npm run dev          # development + hot reload
npm run typecheck    # cek TypeScript
npm run build        # build ke out/
npm run package      # build + installer macOS
npm run package:win  # build installer Windows
npm run preview      # preview hasil build
```

## Struktur

```text
src/
  main/
    index.ts        # Electron main, window, IPC HTTP request
    supabase.ts     # koneksi Postgres/Supabase, upload/pull/history
  preload/
    index.ts        # jembatan window.api ke renderer
  renderer/src/
    App.tsx         # state workspace + interaksi utama
    components/     # komponen UI reusable
    data/           # default collection/request/environment
    hooks/          # useAppData (load + autosave)
    lib/            # request builder, env, cURL, OpenAPI, format
    services/       # storage lokal + sync client
    types/          # tipe renderer
  shared/types.ts   # tipe yang dipakai main + renderer
```

## Fitur yang sudah ada

- Multi-tab request: buka beberapa request sekaligus, switch tab, close tab (termasuk middle-click)
- Collection tree, rename, duplicate, delete, close & clear collection, clear all collections, search
- Request editor: method, URL, params, auth (Bearer/Basic/API key), headers, body
- Body: none, JSON, raw
- Mock response per request: contoh response dari OpenAPI contract, fallback generated kalau tidak ada
- Save as example: simpan response sebagai contoh dokumentasi (nama + status) di bawah request; tidak mengubah Mock
- Examples tree: contoh response tampil sebagai child request, bisa dibuka, di-preview, dan dihapus
- Response viewer: status, latency, size, JSON highlight, headers
- Environment variables `{{var}}` dan secret variables
- Import cURL (paste di URL bar), import OpenAPI JSON, dan import workspace export (`.json`) dengan pilihan **Add new only** atau **Replace existing** (dedupe berdasarkan nama collection)
- Export/import workspace, local history, rollback
- Sync Supabase: upload, import via URL, history
- Resizable response panel dan context menu

## Aturan arsitektur

1. **Renderer tidak boleh mengakses Node/DB langsung.** Semua lewat `preload/index.ts` dan IPC di `main/index.ts`.
2. **Tipe lintas proses** ditaruh di `src/shared/types.ts`; tipe khusus renderer di `src/renderer/src/types/api.ts`.
3. **Jangan menambah backend server.** Sync memakai koneksi Postgres langsung dari main process.
4. **Secret tidak boleh ikut upload.** Environment variable bertanda secret harus dikosongkan sebelum sync.
5. **Transport HTTP** hanya di main process; renderer memanggil `window.api.sendRequest`.
6. **State** memakai React state + service storage. Jangan tambah state library kecuali diminta.
7. **Komponen reusable**; hindari logika UI besar di `App.tsx` jika bisa dipecah.
8. **Styling** memakai token Tailwind `studio-*`, dark theme, compact, developer-focused.
9. **Jangan commit** `.env`, `*.local.json`, credential, `node_modules`, `out`, `dist`.
10. Jika mengubah signature Electron di macOS, gunakan `npm run fix:electron`; jangan hapus script postinstall.
11. **Mock response** dijalankan di renderer (`services/mock.ts`), tidak lewat IPC dan tidak menyentuh network. Saat `request.mock` aktif, lewati validasi URL/JSON karena tujuannya hanya menampilkan contoh response. Importer OpenAPI mengambil contoh response pertama (prioritas 200 → 2xx) dan mengaktifkan mock otomatis.
12. **Examples** adalah fitur dokumentasi terpisah dari Mock. Simpan di `request.examples` (bukan `mockResponse`), lengkap dengan status, headers, body, dan snapshot request. Jangan mengubah state `mock` saat menyimpan example.

## Konvensi UI

- Dark theme default, sidebar gelap, border subtle.
- Font mono untuk method, URL, JSON, dan code editor.
- Method HTTP punya warna konsisten lewat `lib/methods.ts`.
- Gunakan `studio-scroll` untuk area scroll.
- Pertahankan spacing compact dan layout desktop.

## Verifikasi sebelum selesai

Minimal jalankan:

```bash
npm run typecheck
npm run build
```

Untuk perubahan UI, cek alur: pilih request → edit → send → response; tambah/hapus param dan header; ganti body; buka environment; import cURL; expand/collapse collection.

Untuk perubahan mock: import file OpenAPI (`hoppscotch-team-collections-openapi.json`), pilih request yang punya contoh response, pastikan toggle Mock aktif, lalu Send. Response harus menampilkan badge **Mock** tanpa network call. Request tanpa contoh response harus memakai fallback mock.

## Batas scope

Jangan menambah fitur besar tanpa diminta: OAuth flow kompleks, WebSocket, GraphQL, automated testing, AI, plugin system, atau team collaboration. Prioritaskan stabilitas UI/UX dan alur API client inti.
