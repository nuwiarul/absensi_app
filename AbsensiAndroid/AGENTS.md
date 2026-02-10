# AGENTS.md — Android (Kotlin + Jetpack Compose + Retrofit + Hilt)

Pedoman wajib untuk AI agent & developer saat mengubah project Android.

---

## 1) Prinsip Utama
### ✅ Zero Duplication
- Tidak boleh copy-paste logic.
- Jika pola muncul ≥ 2 kali → ekstrak jadi modul reusable.

### ✅ Modular & Reusable
- Pecah logic besar jadi:
    - ViewModel
    - Repository
    - UseCase (opsional, bila lintas fitur/kompleks)
    - UI components reusable
    - Mapper reusable

### ✅ No Business Logic in Composable
- Composable hanya render UI + emit events.
- Fetching/validasi/mapping ada di ViewModel/UseCase/Repository.

---

## 2) Source of Truth API
Jika ragu field API/DTO:
- cek backend di: **`E:\resta_pontianak\backend`**
- jangan menebak field/enum/nullability.

---

## 3) Dependency Injection (Hilt) — Wajib
- Gunakan Hilt sebagai satu-satunya jalur dependency:
    - `@HiltAndroidApp` untuk Application
    - `@AndroidEntryPoint` untuk Activity/Fragment (jika ada)
    - `@HiltViewModel` untuk ViewModel
    - `@Inject` constructor untuk Repository/UseCase
- Provider:
    - Retrofit/OkHttp/Interceptors/ApiService disediakan lewat `di/*` dengan `@Module`.
- Dilarang:
    - service locator manual
    - singleton global buatan sendiri
    - membuat Retrofit instance di banyak tempat

---

## 4) Networking (Retrofit) — Konvensi
- `data/remote/*` berisi Retrofit service interface.
- Error handling harus konsisten:
    - buat `ApiResult/NetworkResult` sealed class (jika belum ada) dan gunakan di semua repository.
- Semua response typed (tidak boleh `Any`).
- Mapping DTO -> Domain/UI jangan di UI layer.

---

## 5) Struktur Folder (Rule of Thumb)
> Ikuti struktur repo yang sudah ada; ini pedoman umum.

- `ui/screens/*` : Screen composable
- `ui/components/*` : reusable composable
- `viewmodel/*` : ViewModel per fitur
- `domain/usecase/*` : logic bisnis reusable (opsional)
- `data/remote/*` : Retrofit API
- `data/repository/*` : repository impl
- `data/model/*` : DTO + mapper
- `di/*` : Hilt modules
- `utils/*` : helper murni

Decision table:
- UI reusable → `ui/components`
- Logic lintas screen → `domain/usecase`
- Retrofit service → `data/remote`
- API result/error mapping → `data/repository` (shared helper)
- DI Retrofit/OkHttp → `di/*`

---

## 6) State & Error Handling
- Gunakan `sealed class UiState` dan `UiEvent`.
- Expose state dari ViewModel via `StateFlow`.
- Error ditangani di ViewModel (UI hanya render).

---

## 7) Refactor Policy (Wajib)
Jika menemukan duplikasi:
1) Identifikasi pola
2) Ekstrak jadi:
    - helper function / mapper / component / usecase
3) Terapkan ulang di semua tempat
4) Pastikan behavior tetap sama

---

## 8) Anti-Pattern (Dilarang)
❌ Copy-paste logic antar ViewModel/Screen  
❌ Business logic di Composable  
❌ `!!` dan type cast tanpa validasi  
❌ Membuat Retrofit/OkHttp di banyak tempat  
❌ Menggunakan `Any` untuk data API

---

## 9) Checklist Sebelum Final
- [ ] Tidak ada duplikasi logic
- [ ] Tidak ada `!!`
- [ ] Tidak ada `Any`
- [ ] Semua DI lewat Hilt (tidak ada instance manual)
- [ ] Build lolos + tidak ada unused imports
- [ ] Field API sinkron backend (`E:\resta_pontianak\backend`)
- [ ] Naming konsisten

---

## 10) Format Output Agent
1) Ringkasan perubahan (3–7 bullet)
2) Daftar file berubah/baru
3) Patch per file (diff) atau full file jika diminta  
