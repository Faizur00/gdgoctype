-- 002: query pemeriksaan skor mencurigakan. Hanya SELECT, aman dijalankan kapan saja.
-- Jalankan sebelum mengumumkan juara.

-- 1) skor sangat tinggi (manusia jarang di atas 150 WPM)
select name, wpm, accuracy, created_at
from public.scores
where wpm > 150
order by wpm desc;

-- 2) dua skor dari nama yang sama dalam jarak kurang dari 55 detik
--    (tes 1 menit tidak mungkin selesai lebih cepat dari itu di satu perangkat)
select name, wpm, created_at, selisih
from (
  select name, wpm, created_at,
         created_at - lag(created_at) over (
           partition by lower(trim(name)) order by created_at
         ) as selisih
  from public.scores
) t
where selisih < interval '55 seconds'
order by created_at desc;

-- 3) nama dengan jumlah skor sangat banyak (kemungkinan spam)
select lower(trim(name)) as name_key, count(*) as jumlah,
       min(created_at) as pertama, max(created_at) as terakhir
from public.scores
group by 1
having count(*) > 30
order by jumlah desc;

-- 4) KANDIDAT tabrakan nama (dua perangkat menabrak name_key yang sama).
--    Hasil ini hanya kandidat, BUKAN duplikat pasti: skema tidak menyimpan
--    perangkat, jadi DB tidak bisa membedakan orang. Satu orang yang mencoba
--    ulang punya name_key sama (itu normal), maka jangan pakai count(*) > 1.
--    Sinyal yang dipakai: dua skor name_key sama dengan jarak < 55 detik tidak
--    mungkin dari satu perangkat (tes 1 menit). Cek manual sebelum bertindak;
--    jangan hapus skor percobaan ulang yang sah.
  select name_key, id, name, wpm, created_at, selisih
  from (
    select lower(trim(name)) as name_key, id, name, wpm, created_at,
          created_at - lag(created_at) over (
            partition by lower(trim(name)) order by created_at
          ) as selisih
    from public.scores
  ) t
  where selisih < interval '55 seconds'
  order by name_key, created_at;

-- 5) hapus satu nama yang terbukti curang (ganti 'nama-key' dengan huruf kecil)
-- delete from public.scores where lower(trim(name)) = 'nama-key';
