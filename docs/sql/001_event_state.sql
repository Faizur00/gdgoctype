-- 001: kontrol sesi lewat database.
-- Jalankan sekali di Supabase -> SQL Editor. Aman dijalankan ulang.
--
-- Hasil:
--   * tabel event_state (satu baris): open, leaderboard_hidden, ends_at
--   * anon hanya boleh INSERT ke scores saat sesi terbuka
--   * batas WPM 200

-- 1) status sesi (satu baris saja)
create table if not exists public.event_state (
  id boolean primary key default true check (id),
  open boolean not null default true,
  leaderboard_hidden boolean not null default false,
  ends_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.event_state (id) values (true) on conflict do nothing;

alter table public.event_state enable row level security;
grant select on public.event_state to anon;
drop policy if exists "anon read event_state" on public.event_state;
create policy "anon read event_state" on public.event_state
  for select to anon using (true);

-- 2) hapus policy INSERT lama di scores, ganti dengan yang menghormati sesi
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'scores' and cmd = 'INSERT'
  loop
    execute format('drop policy %I on public.scores', p.policyname);
  end loop;
end $$;

create policy "anon insert while open" on public.scores
  for insert to anon
  with check (
    exists (
      select 1 from public.event_state e
      where e.open and (e.ends_at is null or now() < e.ends_at)
    )
  );

-- 3) batas WPM 200 (harus sama dengan MAX_WPM di frontend/src/ts/kiosk/api.ts)
alter table public.scores drop constraint if exists scores_wpm_range;
alter table public.scores
  add constraint scores_wpm_range check (wpm >= 0 and wpm <= 200);

-- (opsional) cabut dan kembali ke keadaan semula untuk uji:
--   drop policy "anon insert while open" on public.scores;
--   create policy "anon insert" on public.scores for insert to anon with check (true);
