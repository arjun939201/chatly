-- posts.id is bigint; keep post_reports.post_id aligned with the referenced key.
create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id bigint not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','hate','violence','sexual','other')),
  details text check (char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

create index if not exists post_reports_created_at_idx
  on public.post_reports(created_at desc);

alter table public.post_reports enable row level security;

drop policy if exists "Users can submit post reports" on public.post_reports;
create policy "Users can submit post reports"
  on public.post_reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id)
  );
