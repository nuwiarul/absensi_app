# AGENTS.md — Admin Web (React + TypeScript + shadcn/ui + bun)

Dokumen ini adalah pedoman kerja untuk AI agent maupun developer saat mengubah project Admin Web.

## 1) Prinsip Utama
1. **Zero Duplication**
    - Tidak boleh ada copy-paste logic.
    - Jika sebuah pola muncul ≥ 2 kali, wajib diekstrak menjadi modul reusable.

2. **No `any`**
    - Dilarang memakai `any`.
    - Jika tipe belum jelas: gunakan `unknown` + validasi (type guard / zod jika repo sudah memakai).
    - Hindari `as SomeType` tanpa validasi.

3. **Modular & Reusable**
    - Pecah code menjadi komponen/hook/service kecil, single responsibility.
    - Hindari “god component” dan util raksasa.

4. **Build & Lint Wajib Lulus**
    - Setiap perubahan harus lulus:
        - `bun run lint`
        - `bun run build`

## 2) Sumber Kebenaran API
Jika perlu mengecek field DTO/response/params:
- Backend ada di **`E:\resta_pontianak\backend`**.
- Frontend types harus sinkron dengan kontrak backend.
- Jangan “menebak” field response; verifikasi dari backend.

## 3) Struktur & Penempatan Kode (Rule of Thumb)
> Catatan: ikuti struktur repo yang sudah ada. Ini pedoman penempatan.

- `src/features/<feature>/...`
    - Tempat utama untuk domain/fitur (CRUD, halaman, hooks, types, api).
- `src/components/...`
    - Reusable UI/compound components lintas fitur.
- `src/components/ui/...`
    - Komponen shadcn (jaga agar tetap standard shadcn; modifikasi minimal).
- `src/lib/...` atau `src/utils/...`
    - Helper umum: formatting, parsing, querystring, date utils.
- `src/hooks/...`
    - Hook reusable lintas fitur (mis. pagination URL, debounce, permissions).

**Decision table:**
- UI kecil yang dipakai banyak tempat → `src/components/`
- Logic data fetching per fitur → `src/features/<feature>/hooks.ts` + `api.ts`
- Types & DTO mapping per fitur → `src/features/<feature>/types.ts`
- Helper umum (pure) → `src/lib/` atau `src/utils/`

## 4) Konvensi Data Fetching & Types
- Response dari API dianggap **tidak tepercaya** secara tipe:
    - parse `unknown` → validasi → baru menjadi tipe final
    - atau gunakan pola existing repo (jika sudah ada helper `api.ts` yang typed, ikuti)
- Jangan menyebarkan tipe longgar.
- Jika ada list/paginate pattern, jadikan **generic reusable** (tanpa `any`):
    - contoh: `Paginated<T>` + mapper.

## 5) Komponen UI & shadcn/ui
- Gunakan komponen shadcn (`Button`, `Dialog`, `Table`, `Card`, dll) untuk konsistensi.
- Untuk pola berulang:
    - Buat **komponen reusable**: contoh `TableToolbar`, `ConfirmDialog`, `PageHeader`, `EmptyState`.
- Styling:
    - Tailwind class konsisten, hindari duplikasi class panjang → ekstrak wrapper component jika sering dipakai.

## 6) Refactor Policy (Wajib jika menemukan duplikasi)
Jika menemukan duplikasi:
1) Identifikasi kesamaan dan perbedaan
2) Ekstrak:
    - fungsi helper (pure) atau
    - hook reusable, atau
    - komponen reusable
3) Terapkan kembali di semua tempat yang sebelumnya duplikat
4) Pastikan behavior tetap sama

## 7) Checklist Sebelum Selesai
- [ ] Tidak ada `any`
- [ ] Tidak ada duplikasi logic yang jelas
- [ ] `bun run lint` lulus
- [ ] `bun run build` lulus
- [ ] Perubahan tidak breaking (kecuali diminta)
- [ ] Types & kontrak API sesuai backend (cek `E:\resta_pontianak\backend` bila perlu)

## 8) Format Output Agent Saat Mengirim Patch
1) Ringkasan perubahan (3–7 bullet)
2) Daftar file berubah/baru
3) Patch per file (diff) atau full file jika diminta
