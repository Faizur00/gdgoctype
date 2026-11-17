-- 003: hasil akhir untuk pengumuman. Hanya SELECT.

-- top 10 (skor terbaik per nama, seri diputus akurasi)
select peringkat, name, wpm, accuracy
from public.leaderboard
order by peringkat, created_at
limit 10;

-- ringkasan
select count(*) as jumlah_percobaan,
       count(distinct lower(trim(name))) as jumlah_peserta,
       max(wpm) as wpm_tertinggi,
       round(avg(wpm), 2) as wpm_rata_rata
from public.scores;

-- semua peserta (untuk dokumentasi), skor terbaik masing-masing
select peringkat, name, wpm, accuracy, created_at
from public.leaderboard
order by peringkat, created_at;
