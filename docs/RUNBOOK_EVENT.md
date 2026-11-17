# Runbook hari-H: Ice Breaking Type Fast

Semua kontrol lewat **Supabase → SQL Editor** (atau Table Editor → tabel `event_state`, klik nilainya). Tidak perlu deploy ulang. Satu operator, satu layar.

URL peserta: `https://gdgoc-unhas-type.netlify.app/`
URL layar proyektor: `https://gdgoc-unhas-type.netlify.app/leaderboard`

## H-1 (sehari sebelum, 21 Nov)

- [ ] Buka Supabase dashboard: proyek **Active** (proyek gratis bisa *pause* jika tidak aktif). Kalau paused, klik Restore dan tunggu.
- [ ] SQL `docs/sql/001_event_state.sql` sudah dijalankan (ada tabel `event_state` dan 1 barisnya).
- [ ] Kosongkan data uji: `delete from public.scores;`
- [ ] Keadaan awal: `update public.event_state set open = true, leaderboard_hidden = false, ends_at = null;`
- [ ] Buka URL peserta dari **laptop lain** (bukan laptop operator) dan mainkan satu tes. Skor masuk, muncul di `/leaderboard`. Lalu `delete from public.scores;` lagi.
- [ ] Uji kunci: `update public.event_state set open = false;` → halaman peserta menampilkan "Sesi sudah ditutup" (maks 5 detik) dan skor baru ditolak. Lalu `set open = true;`.
- [ ] Uji sembunyi: `update public.event_state set leaderboard_hidden = true;` → `/leaderboard` menampilkan "Leaderboard Hidden". Lalu `set leaderboard_hidden = false;`.
- [ ] Layar proyektor: browser fullscreen (F11), satu tab, resolusi dicek, hard refresh (Ctrl+Shift+R).
- [ ] Wi-Fi lokasi: cek koneksi dari laptop yang dipakai peserta.

## Hari-H, urutan sesi

| Waktu | Aksi | SQL |
|---|---|---|
| Mulai | Tampilkan QR + link, bagikan link ke grup | `update public.event_state set open = true, leaderboard_hidden = false;` |
| Selama sesi (5-10 mnt) | Leaderboard sementara tampil di proyektor | (tidak ada) |
| **Sisa 1 menit** | Sembunyikan leaderboard ("makin deg-degan") | `update public.event_state set leaderboard_hidden = true;` |
| **Waktu habis** | Kunci web. Tes yang sedang berjalan tidak tersimpan | `update public.event_state set open = false;` |
| Periksa | Jalankan pengecekan curang (`docs/sql/002_anticheat.sql`), verifikasi juara | |
| **Umumkan** | Tampilkan leaderboard akhir | `update public.event_state set leaderboard_hidden = false;` |

Opsional: penutupan otomatis. Isi `ends_at` supaya database menolak skor sendiri saat waktunya lewat:

```sql
update public.event_state set ends_at = now() + interval '10 minutes';
```

## Kalau ada masalah

| Gejala | Tindakan |
|---|---|
| Peserta bilang skor tidak masuk | Cek `open = true` dan `ends_at` kosong/belum lewat. Cek Wi-Fi. Skor yang tertunda tersimpan di perangkat dan terkirim sendiri saat online. |
| Leaderboard kosong padahal ada skor | Cek `leaderboard_hidden = false`. Hard refresh layar proyektor. |
| Ada skor aneh (WPM tinggi) | `docs/sql/002_anticheat.sql`, lalu minta orangnya main ulang di depan panitia. Hapus: `delete from public.scores where lower(trim(name)) = 'nama-key';` |
| Situs tidak bisa dibuka | Cek status Netlify. Cadangan: unggah ulang folder `frontend/dist` (lihat `docs/GDGOC_KIOSK.md`). |
| Salah tutup sesi | `update public.event_state set open = true;` |
| Mulai ulang kompetisi dari nol | `delete from public.scores;` lalu keadaan awal di atas |

## Setelah acara

- [ ] Simpan hasil: `docs/sql/003_results.sql` (screenshot atau export CSV dari Table Editor).
- [ ] Opsional: `update public.event_state set open = false;` dibiarkan agar web tetap terkunci.
