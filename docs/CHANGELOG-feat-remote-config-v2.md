# Remote Config v2 — Changelog

Tanggal: 21 Juli 2026
Branch: `feat/kanban-task-board`

---

## 1. Environment Tabs (Dev/Prod) — `ProjectDetail.tsx`

**Sebelum:** Dropdown pilih suffix (`_dev` / kosong)  
**Sesudah:** Tab Dev 🟡 / Prod 🟢 diatas form Nama Template

| Tab | Suffix (internal) | Backend Host |
|-----|------------------|-------------|
| 🟡 Dev | `_dev` | `http://127.0.0.1:8003` |
| 🟢 Prod | `''` | `https://kibumn.co.id` |

- Template list di-filter oleh suffix sesuai tab aktif.
- Tombol sync menampilkan host yang sesuai: `🔄 Sync dari localhost:8003` / `🔄 Sync dari kibumn.co.id`.
- Display suffix (`_dev`) dihapus dari UI — suffix sudah tidak tampil di card template, review modal, maupun tabel history.

**File:** `client/src/pages/ProjectDetail.tsx`, `client/src/pages/RemoteConfig.tsx`

---

## 2. Store URLs — Static & Safe Sync — `ProjectDetail.tsx`

- Store URLs (Android & iOS) diubah dari `<input>` menjadi `<p>` dengan latar abu-abu — **tidak bisa diedit**.
- Sync tidak menimpa store URL: hanya diisi jika backend mengembalikan nilai truthy (`if (vals.android_store_url)` guard).

**File:** `client/src/pages/ProjectDetail.tsx`

---

## 3. Sync dari Laravel Backend — `routes/api.js`

Endpoint: `GET /api/remote-config/sync/:projectId?env=dev|prod`

**Sebelum:** Fetch dari Firebase Remote Config REST API.  
**Sesudah:** Fetch dari Laravel backend via URL yang sesuai dengan env.

- Error real: mengembalikan `HTTP {status} {text} dari {url}` jika backend unreachable.
- Backend response diparse untuk mengekstrak key `_dev` (jika env=dev) dan non-`_dev` (jika env=prod).

**File:** `routes/api.js`

---

## 4. Unified Version Keys — `routes/api.js`, `ProjectDetail.tsx`

### Backend Publish

**Sebelum:** Mengirim 4 key ke Laravel backend:
- `android_minimum_version[_dev]`, `android_latest_version[_dev]`
- `ios_minimum_version[_dev]`, `ios_latest_version[_dev]`

**Sesudah:** Mengirim 2 key:
- `minimum_version[_dev]`, `latest_version[_dev]`

Backend Laravel (generic key-value) tetap kompatibel.

### Frontend Input

**Sebelum:** 4 input text (Android Min, Android Latest, iOS Min, iOS Latest).  
**Sesudah:** 2 dropdown **Min Version**, **Latest Version** — Android & iOS menerima value yang sama.

### Sync

Sync endpoint tetap mengembalikan format lama (`android_min`, `android_latest`, `ios_min`, `ios_latest`) untuk kompatibilitas — namun value diambil dari key baru (`minimum_version`) dengan fallback ke key lama (`android_minimum_version`).

**File:** `routes/api.js`, `client/src/pages/ProjectDetail.tsx`

---

## 5. Dynamic Version Select — `ProjectDetail.tsx`

Dropdown version menampilkan 3 saran yang di-generate dari base version (hasil sync):

| Saran | Bump |
|-------|------|
| `X.Y.Z+1 (patch)` | Patch |
| `X.Y+1.1 (minor)` | Minor |
| `X+1.1.1 (major)` | Major |

- Base version ditangkap sekali saat sync (via `rcSyncVersions` ref) — **saran tidak berubah** meskipun user sudah memilih salah satu.
- Sebelum sync, dropdown **disable** dengan teks "🔄 Sync dulu".
- Opsi "✏️ Kustom..." untuk input manual, dengan tombol "← Kembali ke pilihan".
- Validasi real-time via Zod: `z.string().regex(/^\d+\.\d+\.\d+$/)`.

**File:** `client/src/pages/ProjectDetail.tsx`

---

## 6. Wajib Sync Sebelum Simpan — `ProjectDetail.tsx`

Validasi sebelum menyimpan template:
1. **Versi kosong** → ❌ "Silakan sync dari {host} terlebih dahulu untuk mendapatkan versi terbaru."
2. **Draft masih ada** → ❌ "Masih ada draft '{name}' di env {Dev/Prod}. Publis atau hapus draft terlebih dahulu."

**File:** `client/src/pages/ProjectDetail.tsx`

---

## 7. Version Validation Backend — `routes/api.js`

Fungsi `compareSemver(a, b)` membandingkan versi numerik. Saat publish, backend memeriksa:
- Versi baru harus **lebih besar** dari versi terakhir yang dipublish untuk env yang sama.
- Jika tidak: `400 "Versi {new} tidak valid. Versi {Dev/Prod} terakhir: {last}. Gunakan versi yang lebih baru."`

**File:** `routes/api.js`

---

## 8. ADB PATH Fix — `routes/api.js`

Fungsi `findAdb()` mencari binary `adb` di:
1. `~/Library/Android/sdk/platform-tools/adb`
2. `$ANDROID_HOME/platform-tools/adb`
3. `$ANDROID_SDK_ROOT/platform-tools/adb`
4. Fallback ke `adb` dari PATH

Semua pemanggilan `execSync('adb ...')` dan `spawn('adb', ...)` menggunakan full path yang ditemukan. Mencegah error `/bin/sh: adb: command not found`.

**File:** `routes/api.js`

---

## 9. Flutter Service — `app_update_remote_config_service.dart`

Service baru `ApiAppUpdateRemoteConfigService` menggantikan `FirebaseAppUpdateRemoteConfigService`:

- Fetch dari process-manager API: `GET {baseUrl}/api/app-config/{slug}`
- Membaca unified keys: `minimum_version` / `latest_version` (dengan suffix `_dev` sesuai env).
- Store URL tetap platform-specific: `android_store_url[_dev]` / `ios_store_url[_dev]`.
- Dependencies: Dio (sudah ada di pubspec), tidak perlu Firebase.

Konfigurasi via environment variable:
- `RC_BASE_URL` — base URL process-manager (default: `http://127.0.0.1:9876`)
- `RC_SUFFIX` — suffix key (`_dev` untuk dev, `''` untuk prod)

**File:** `lib/core/app_update/app_update_remote_config_service.dart`

---

## 10. Default Title/Message by Mode — `ProjectDetail.tsx`

`useEffect` pada `rcMode` secara otomatis mengisi default:

| Mode | Title | Message |
|------|-------|---------|
| Force | "Pembaruan wajib" | "Silakan perbarui aplikasi Anda sekarang untuk melanjutkan." |
| Lainnya | "Pembaruan tersedia" | "Silakan perbarui aplikasi ke versi terbaru untuk pengalaman terbaik." |

**File:** `client/src/pages/ProjectDetail.tsx`
