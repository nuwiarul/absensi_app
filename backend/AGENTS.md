# AGENTS.md — Engineering Guide (Backend Axum + SQLx)

Dokumen ini adalah aturan kerja untuk AI agent maupun developer saat mengubah repo backend.

## 1. Tujuan
- Menjaga codebase **rapi, modular, mudah dirawat**.
- Menolak praktik **copy-paste**: semua logic yang berulang harus diekstrak jadi helper/module.
- Menjaga behavior API tetap stabil kecuali ada instruksi eksplisit untuk mengubah.

## 2. Arsitektur Repo (Saat Ini)
Struktur utama:
- `src/main.rs`  
  Bootstrap server, CORS, AppState (Config, DBClient, Redis, upload_dir).
- `src/routes.rs`  
  Registrasi router `/api/*` dan middleware auth.
- `src/handler/*`  
  Lapisan HTTP (Axum Router + handler). Tidak boleh menulis query SQL panjang di sini.
- `src/database/*`  
  Lapisan akses DB: SQLx queries & repository-style functions.
- `src/dtos/*`  
  Semua request/response DTO (serde).
- `src/middleware/*`  
  Auth middleware, dsb.
- `src/utils/*`  
  Helper umum (pure helper).
- `migrations/*`  
  SQL migrations (append-only, jangan edit migration lama).

**Rule arsitektur:**
- Handler hanya:
    - parsing input (Json/Query/Path/MultiPart)
    - validasi ringan
    - memanggil database/services
    - mapping ke response DTO
- Semua query DB berada di `database/*`.
- Logic bisnis lintas fitur (dipakai banyak handler) harus masuk `services/*` (buat folder ini jika belum ada).

## 3. Prinsip Refactor: ZERO Duplication
### 3.1 Deteksi & tindakan
Jika kamu menemukan 2+ lokasi dengan logic mirip:
- Ekstrak jadi fungsi reusable.
- Tentukan lokasi yang benar:
    - `utils/*`: logic murni, tidak tergantung AppState/DB.
    - `database/*`: logic query DB atau mapping row -> model.
    - `services/*`: logic bisnis kompleks (melibatkan banyak repository, validasi domain, kalkulasi).

### 3.2 Modularitas
- Fungsi kecil, single responsibility.
- Nama jelas dan konsisten.
- Hindari module “god utils”.

## 4. Konvensi Error Handling
- Hindari `unwrap()` kecuali pada bootstrap yang memang fatal (mis. bind listener).
- Gunakan `Result<_, HttpError>` pada handler.
- Pastikan pesan error:
    - aman untuk client
    - tetap informatif untuk developer (log internal bila perlu)

## 5. Konvensi SQLx & Migrasi
- Upayakan `sqlx::query!` / `query_as!` untuk compile-time checking.
- Jika schema berubah:
    - tambah file migration baru `migrations/NNN_*.sql`
    - jangan ubah migration lama yang sudah pernah dipakai.
- Mapping field: pastikan sinkron antara:
    - migration schema
    - query SQL
    - DTO output

## 6. Konvensi Routing & Middleware
- Semua endpoint baru harus:
    - ditambahkan di router handler file terkait (`src/handler/*.rs`)
    - lalu di-nest di `src/routes.rs` (biasanya di bawah middleware auth)
- Endpoint yang butuh auth wajib pakai `middleware::from_fn(auth_middleware)`.

## 7. Standar Kualitas (Wajib)
Sebelum PR/patch selesai:
- `cargo fmt`
- `cargo check`
- Tidak ada unused import/variable.
- Tidak ada duplikasi logic.

## 8. Output Format untuk Agent (Wajib)
Saat mengirim patch/perubahan:
1) Ringkasan singkat perubahan (3-7 bullet).
2) Daftar file yang berubah/baru.
3) Patch/diff per file (lebih disukai), atau full content file jika diff tidak memungkinkan.

## 9. Template Keputusan: “Taruh di mana?”
Gunakan aturan cepat ini:
- “Ini query DB?” → `src/database/*`
- “Ini mapping request/response?” → `src/dtos/*`
- “Ini business rule dipakai banyak endpoint?” → `src/services/*`
- “Ini helper umum (date/time formatting, parsing, guard)?” → `src/utils/*`
- “Ini HTTP extraction/response?” → `src/handler/*`

## 10. Anti-Pattern (Dilarang)
- Copy-paste logic lintas handler.
- Query SQL besar di handler.
- Mengedit migration lama.
- Menambah fungsi raksasa yang sulit dibaca.
