# GDGoC Type (mode kios)

Fork Monkeytype untuk acara ice breaking welcoming member GDGoC Unhas (22 November 2026).

- **Peserta** membuka web lewat QR/link di laptop masing-masing: tes **1 menit**, English, boleh mengulang dengan nama sama (yang dihitung skor tertinggi).
- **Layar proyektor**: `/leaderboard` live (top 10), bisa disembunyikan di menit terakhir.
- **Panitia** membuka, menyembunyikan, dan mengunci sesi lewat tabel `event_state` di Supabase.

Hosting statis di Netlify, data skor di Supabase. Tidak ada backend Monkeytype, akun, atau login.

Dokumen lain: **`docs/ROADMAP_TIM_TAMPILAN.md`** (tim tampilan), **`docs/RUNBOOK_EVENT.md`** (operator hari-H), **`docs/sql/`** (SQL Supabase).

## Menjalankan di lokal

```powershell
pnpm install
pnpm dev-fe            # http://localhost:3000 (jangan jalankan dua instance)
```

File yang **tidak ada di git** (di-gitignore), buat sendiri sebelum build/dev:

```powershell
cd frontend/src/ts/constants
copy firebase-config-example.ts firebase-config.ts
copy firebase-config-example.ts firebase-config-live.ts
```

Firebase tidak dipakai sama sekali (init dimatikan), file ini hanya agar build tidak error. Jangan commit file itu dan jangan commit `.env`.

## Build dan deploy

Build produksi Monkeytype mewajibkan dua variabel. Nilainya dummy, tidak dipakai:

```powershell
$env:RECAPTCHA_SITE_KEY="unused"; $env:BACKEND_URL="https://backend.invalid"; pnpm build-fe
```

Hasilnya `frontend/dist`. Deploy manual: seret folder `dist` ke Netlify (Deploys → drag and drop). `frontend/static/_redirects` (`/* /index.html 200`) ikut tersalin supaya `/leaderboard` bisa dibuka langsung.

Cek build lokal sebelum upload:

```powershell
cd frontend
$env:RECAPTCHA_SITE_KEY="unused"
pnpm exec vite preview --port 4173
```

## Peta file kios

| Area | File |
|---|---|
| Tema dan dekorasi | `frontend/static/themes/gdgoc.css`, `frontend/static/images/deco/*.svg`, `constants/themes.ts` (tema `gdgoc`), `controllers/theme-controller.ts` (tema dikunci) |
| Branding | `components/layout/header/Logo.tsx`, `components/core/FavIcon.tsx`, `frontend/src/index.html`, `components/layout/footer/Footer.tsx`, `frontend/static/images/gdgoc-logo.svg` |
| Config terkunci | `constants/locked-config.ts` (dipakai `config/setters.ts` dan `config/lifecycle.ts`): time 60, english, tanpa punctuation/numbers, funbox kosong, ads off, tema gdgoc |
| Nama pemain | `kiosk/phase.ts` (state), `kiosk/player-state.ts` (aksi), `components/pages/test/PlayerGate.tsx` (overlay) |
| Kirim skor | `kiosk/api.ts` (REST Supabase), `kiosk/event-state.ts` (status sesi), `kiosk/score-queue.ts` (antrean offline), `kiosk/score-flow.ts` + `components/pages/test/result/ScoreSummary.tsx` (hasil), hook di `test/test-logic.ts` (`finish()`) |
| Leaderboard live | `components/pages/KioskLeaderboardPage.tsx`, route `/leaderboard` di `router/routes.ts`, header/footer disembunyikan di `components/core/App.tsx` |
| Supabase | `constants/supabase.ts` (URL + publishable key, publik) |

(Semua path `ts` di atas relatif ke `frontend/src/ts/`.)

## Aturan dan keputusan penting

- **Satu nama = satu baris**: leaderboard menampilkan skor terbaik per nama (`lower(trim(name))`). Karena itu overlay meminta inisial/angkatan.
- **Poin = WPM net**, seri diputus akurasi. Tidak ada akurasi minimum.
- **Tes tidak valid tidak dikirim** (AFK 5 detik terakhir, timer tersendat karena pindah tab, dll.). Peserta bisa "Coba lagi" dengan nama sama.
- **Skor tidak boleh hilang**: disimpan di antrean `localStorage` dulu, id dibuat di klien (`crypto.randomUUID()`), respons 409 dianggap sukses. Antrean dikirim ulang saat online.
- **Hanya satu domain luar yang boleh dipanggil**: `dnqfgrvqgsteskrmjfma.supabase.co`. Cek tab Network setelah setiap perubahan besar.
- **Hanya `apikey` publishable** yang dipakai di klien. **Jangan pernah** memakai atau commit key `sb_secret_...`.
- Di halaman hasil, tombol utama "Main lagi" (nama sama) dan "Ganti nama". Nama diingat di perangkat (`localStorage`). Tidak ada hitung mundur otomatis.
- **Sesi dikendalikan database**: tabel `event_state` (`open`, `leaderboard_hidden`, `ends_at`). Saat `open=false` atau `ends_at` lewat, policy INSERT di `scores` menolak skor, dan UI menampilkan "Sesi sudah ditutup". Frontend hanya mengikuti (`kiosk/event-state.ts`, polling 5 detik, gagal = dianggap terbuka).
- Batas WPM 200 (constraint DB `scores_wpm_range` dan `MAX_WPM` di `kiosk/api.ts` harus sama).
- Sentry, analytics, Firebase, iklan, PSA, banner merch, modal cookie sudah dimatikan.

## Supabase (ringkas)

- Tabel `public.scores` (`id`, `name` 1-24 karakter, `wpm` 0-350, `accuracy` 0-100, `created_at`).
- View `public.leaderboard` (kolom `peringkat`, `name`, `name_key`, `wpm`, `accuracy`, `created_at`): skor terbaik per nama.
- Role `anon` hanya boleh `SELECT` dan `INSERT`. Update/delete diblokir.
- Hapus data tes lewat SQL Editor, bukan lewat API: `delete from public.scores;`

## Verifikasi sebelum PR

```powershell
cd frontend; npx tsc --noEmit -p .
cd ..; npx oxlint --type-aware --type-check --format agent <file yang diubah>
```

- Test vitest bawaan Monkeytype **memang gagal** (auth mati, gerbang nama, tema terkunci, nav baru). Jangan diperbaiki dan jangan dijadikan syarat. Commit dengan `--no-verify`.
- Tes manual minimum: overlay nama → tes valid → peringkat muncul dan masuk ke `/leaderboard`; tes AFK tidak terkirim; offline lalu online mengirim sekali; console tanpa error merah; Network hanya Supabase.

## Yang masih bisa dikerjakan (bagi tugas)

1. **Sisa warna kuning bawaan Monkeytype** (`#e2b714`): fallback `--main-color`/`--caret-color` di `frontend/src/index.html` (sempat berkedip sebelum tema dimuat), `theme-color` dan `msapplication-TileColor` di halaman statis (`404.html`, `terms-of-service.html`, `privacy-policy.html`, `security-policy.html`, `email-handler.html`), ikon `:(` di `html/warnings.html`, `styles/standalone.scss`. Perlu diputuskan mana yang diganti ke biru `#4285f4`.
2. **Halaman 404** masih memakai `monkeymeme.jpg` dan teks bawaan (`components/pages/404Page.tsx`).
3. **Toast bahasa Inggris** ("Test invalid - AFK detected", dll.) muncul bersama kartu Indonesia di hasil tes.
4. **Header di jendela sempit**: teks "Type" tertimpa tombol nav (cek di lebar sekitar 960px).
5. **Halaman legal** (terms, privacy, security) masih isi Monkeytype dengan nama diganti; pertimbangkan dibuang dari footer.
6. **Kode mati** yang bisa dihapus: `components/pages/leaderboard/*` (leaderboard bawaan), `ResultButtons.tsx`, `elements/merch-banner.tsx`, `elements/psa.tsx`, `TestConfig.tsx`, komponen akun/login.
7. Panduan satu halaman untuk panitia (cara mulai, mengulang, arti pesan, jaringan putus).
8. Tes unit untuk `kiosk/name.ts`, `kiosk/score-queue.ts`, `kiosk/api.ts` (fetch palsu).

## Alur kerja git

- Satu tugas = satu branch dari branch kerja (`gdgoc-theme`), mis. `fix/yellow-leftovers`.
- Pesan commit gaya Conventional Commits: `fix(kiosk): ...`, `feat(kiosk): ...`, `chore(kiosk): ...`.
- Jangan commit: `.env`, `firebase-config.ts`, `firebase-config-live.ts`, key rahasia apa pun.
- Jangan hapus `LICENSE`. Atribusi "Berdasarkan Monkeytype (GPL-3.0)" di footer harus tetap ada.
