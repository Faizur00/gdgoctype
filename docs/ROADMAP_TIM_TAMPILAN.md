# Panduan tim tampilan: Ice Breaking Type Fast

Untuk anggota tim yang mengerjakan **tampilan**. Backend, database, dan alur skor dikerjakan Gabriel. Baca file ini dulu, lalu `docs/GDGOC_KIOSK.md` untuk cara menjalankan proyek.

## 1. Mekanisme acara (yang harus kalian bayangkan)

1. Panitia menampilkan **QR + link** di layar. Peserta membuka web di **laptop masing-masing** (bukan HP).
2. Peserta mengisi **nama** (satu kali, diingat di perangkatnya), lalu mengetik. **Satu tes = 1 menit**, bahasa English.
3. Setelah selesai muncul hasil: poin (WPM), akurasi, peringkat. Peserta boleh **main lagi** dengan nama yang sama selama 5-10 menit. Yang dihitung **skor tertinggi** per nama.
4. Layar proyektor menampilkan **leaderboard sementara** (`/leaderboard`).
5. **Sisa 1 menit**: panitia menyembunyikan leaderboard, layar menampilkan "Leaderboard Hidden" supaya peserta deg-degan.
6. **Waktu habis**: panitia mengunci web. Peserta tidak bisa main atau mengirim skor lagi ("Sesi sudah ditutup").
7. Panitia mengumumkan pemenang dan menampilkan leaderboard akhir.

Panitia mengendalikan tahap 5-7 lewat database (Gabriel/operator). **Tim tampilan hanya perlu membuat layar dan statusnya terlihat bagus.**

## 2. Layar yang ada dan siapa yang mengerjakan

| Layar | File | Kondisi tampil | Status |
|---|---|---|---|
| Overlay nama | `components/pages/test/PlayerGate.tsx` | sebelum tes, nama sudah diisi otomatis jika pernah main | ada, perlu dipoles |
| Halaman tes | `components/pages/test/TestPage.tsx` | saat mengetik | bawaan Monkeytype (jangan diubah logikanya) |
| Hasil tes (valid) | `components/pages/test/result/ScoreSummary.tsx` | setelah tes selesai | ada, perlu dipoles |
| Hasil tes (tidak valid) | file yang sama (`InvalidScore`) | tes AFK/timer tersendat | ada, perlu dipoles |
| **Sesi ditutup** | `components/pages/test/SessionClosed.tsx` | saat sesi dikunci | **ada versi dasar** |
| Leaderboard | `components/pages/KioskLeaderboardPage.tsx` | `/leaderboard` | ada, perlu dipoles |
| **Leaderboard Hidden** | `HiddenLeaderboard` di file yang sama | saat leaderboard disembunyikan | **ada versi dasar** |
| **QR + link** | belum ada | di `/leaderboard` (dan/atau halaman `/qr`) | **BARU** |

## 3. Kontrak data (jangan diubah, cukup dipakai)

Komponen tampilan **hanya membaca** fungsi/sinyal ini. Semuanya di `frontend/src/ts/kiosk/`.

| Fungsi | Isi | Dipakai untuk |
|---|---|---|
| `isSessionOpen()` (`event-state.ts`) | `false` jika sesi ditutup | layar "Sesi ditutup" |
| `getSessionEndsAt()` | `Date` atau `null` | hitung mundur sesi (opsional) |
| `isLeaderboardHidden()` | `true` saat disembunyikan | "Leaderboard Hidden" |
| `getPlayerName()` (`player-state.ts`) | nama diingat | overlay nama |
| `getScoreView()` (`score-flow.ts`) | data hasil tes | kartu hasil |
| `fetchTop()` (`api.ts`) | top 10 | daftar leaderboard |

Aksi tombol (panggil saja): `retrySameName()` (Main lagi), `changeName()` (Ganti nama), keduanya dari `kiosk/player-state.ts`.

**Aturan emas:** jangan menambah request ke server dari komponen. Kalau butuh data baru, minta Gabriel menambahkannya ke `kiosk/`.

## 4. Melihat layar tanpa menyentuh database

Jalankan `pnpm dev-fe`, lalu buka (hanya berfungsi di mode dev):

| URL | Hasil |
|---|---|
| `http://localhost:3000/?event=closed` | layar "Sesi sudah ditutup" |
| `http://localhost:3000/leaderboard?event=hidden` | "Leaderboard Hidden" |
| `http://localhost:3000/leaderboard` | leaderboard biasa (butuh data di Supabase) |
| `http://localhost:3000/` | overlay nama, lalu tes |

Untuk melihat kartu hasil cepat: selesaikan satu tes (1 menit). Untuk kartu "tidak valid": mulai tes, ketik satu kata, lalu diam dan **jangan pindah tab** sampai waktu habis.

Jangan ubah isi tabel Supabase untuk keperluan desain. Datanya dipakai bersama.

## 5. Tugas tampilan

Setiap butir = satu branch/PR kecil. "Selesai" artinya: terlihat benar di layar penuh laptop (1366×768 dan 1920×1080), `tsc` dan lint bersih (lihat bagian 7).

1. **QR + link di `/leaderboard`** (prioritas tinggi). QR menuju `https://gdgoc-unhas-type.netlify.app/`, ukuran besar, bisa discan dari jauh di proyektor. Buat sebagai SVG statis di `frontend/static/images/` (hasilkan sekali dari generator QR, tidak perlu library runtime). Tampilkan juga link dalam teks besar.
2. **Halaman `/qr`** layar penuh (opsional): QR besar + link untuk slide "scan sekarang". Perlu route baru di `router/routes.ts` (minta Gabriel menambahkan route-nya, atau ikuti pola `/leaderboard`).
3. **Leaderboard Hidden** dan **Sesi ditutup**: poles desain (animasi tipis, teks, warna). Boleh dibuat mencolok karena momen ini mau dramatis.
4. **Kartu hasil** (`ScoreSummary.tsx`): rapikan hierarki (poin besar, akurasi, peringkat, skor terbaik, status kirim). Tombol: "Main lagi" (utama), "Ganti nama" (sekunder).
5. **Overlay nama** (`PlayerGate.tsx`): teks "Tes 1 menit", pesan error, hint inisial/angkatan.
6. **Leaderboard**: poles baris, lencana, animasi, tampilan saat daftar kosong, badge "offline" dan "Sesi ditutup". Cek terbaca dari jauh.
7. **Sisa warna kuning bawaan Monkeytype** (`#e2b714`): daftar lokasi ada di `docs/GDGOC_KIOSK.md` bagian "Yang masih bisa dikerjakan". Putuskan mana yang diganti ke biru `#4285f4`.
8. **Halaman 404**: ganti gambar `monkeymeme.jpg` dan teks (`components/pages/404Page.tsx`).
9. **Toast bahasa Inggris** ("Test invalid - AFK detected", dll.): terjemahkan atau sembunyikan.
10. **Header di jendela sempit**: teks "Type" tertimpa tombol nav (lebar sekitar 960px).
11. **Teks Indonesia**: periksa semua teks yang terlihat peserta (judul, subjudul, tombol, pesan).
12. **Favicon dan judul tab**: sudah GDGoC. Cek di tab baru (cache browser).

## 6. Yang jangan disentuh

- `frontend/src/ts/test/*` dan `kiosk/*.ts` (logika skor, antrean, kunci sesi): urusan Gabriel.
- `constants/locked-config.ts`: config yang dikunci (waktu, bahasa, tema). Mengubahnya bisa merusak tes.
- `firebase-config*.ts` dan `.env`: jangan commit.
- `LICENSE` dan atribusi "Berdasarkan Monkeytype (GPL-3.0)" di footer.
- Jangan menambah pemanggilan ke domain luar (font CDN, analytics). Hanya `dnqfgrvqgsteskrmjfma.supabase.co` yang boleh dipanggil dari browser, dan itu lewat `kiosk/api.ts`.

## 7. Cara kerja dan cek sebelum PR

```powershell
git checkout gdgoc-theme
git checkout -b feat/nama-tugas        # satu tugas = satu branch
pnpm dev-fe                            # http://localhost:3000
```

Sebelum membuka PR (ke branch `gdgoc-theme`):

```powershell
cd frontend; npx tsc --noEmit -p .
cd ..; npx oxlint --type-aware --type-check --format agent <file yang kamu ubah>
```

- Test vitest bawaan Monkeytype memang gagal (mode kios). Abaikan, commit dengan `--no-verify`.
- Pesan commit: `feat(kiosk): ...`, `fix(kiosk): ...`, `style(kiosk): ...`.
- Sertakan **screenshot** (layar penuh) di PR.
- Tanya Gabriel kalau perlu data/aksi baru dari backend. Jangan membuat solusi sendiri di komponen.

## 8. Jadwal

| Tanggal | Target tampilan |
|---|---|
| 17-18 Nov | Setup lokal; tugas 1 (QR), 3 (hidden/closed), 7, 8 |
| 19 Nov | Tugas 4, 5, 6; gabungkan semua branch |
| 20 Nov | **Bekukan fitur.** Latihan penuh bersama; perbaikan dari hasil latihan |
| 21 Nov | Hanya perbaikan bug |
| 22 Nov | Hari acara (standby) |
