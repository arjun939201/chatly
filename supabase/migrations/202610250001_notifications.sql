-- Chatly notification records: recipient-scoped, private, and deduplicated.
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('like','comment','follow')),
  post_id bigint references public.posts(id) on delete cascade,
  comment_id uuid references public.post_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_no_self_activity check (recipient_id <> actor_id)
);

create index if not exists notifications_recipient_time_idx
  on public.notifications (recipient_id, created_at desc, id desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

-- Authenticated recipients may only mutate the read marker, never notification identity or payload.
revoke insert, update, delete on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

drop policy if exists "Recipients can read their notifications" on public.notifications;
create policy "Recipients can read their notifications"
  on public.notifications for select to authenticated
  using (auth.uid() = recipient_id);

drop policy if exists "Recipients can update their notification read state" on public.notifications;
create policy "Recipients can update their notification read state"
  on public.notifications for update to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Only trusted database triggers create notification rows; clients cannot insert
-- arbitrary actor/recipient pairs directly.
drop policy if exists "Clients cannot create notifications" on public.notifications;
create policy "Clients cannot create notifications"
  on public.notifications for insert to authenticated
  with check (false);

create or replace function public.create_post_like_notification()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare owner_id uuid;
begin
  select p.user_id into owner_id from public.posts p where p.id = new.post_id;
  if owner_id is not null and owner_id <> new.user_id then
    insert into public.notifications(recipient_id, actor_id, type, post_id)
    values(owner_id, new.user_id, 'like', new.post_id);
  end if;
  return new;
end;
$$;

drop trigger if exists post_like_notification_insert on public.post_likes;
create trigger post_like_notification_insert after insert on public.post_likes
for each row execute procedure public.create_post_like_notification();

create or replace function public.create_post_comment_notification()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare owner_id uuid;
begin
  select p.user_id into owner_id from public.posts p where p.id = new.post_id;
  if owner_id is not null and owner_id <> new.user_id then
    insert into public.notifications(recipient_id, actor_id, type, post_id, comment_id)
    values(owner_id, new.user_id, 'comment', new.post_id, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists post_comment_notification_insert on public.post_comments;
create trigger post_comment_notification_insert after insert on public.post_comments
for each row execute procedure public.create_post_comment_notification();

create or replace function public.create_follow_notification()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.follower_id <> new.following_id then
    insert into public.notifications(recipient_id, actor_id, type)
    values(new.following_id, new.follower_id, 'follow');
  end if;
  return new;
end;
$$;

drop trigger if exists user_follow_notification_insert on public.user_follows;
create trigger user_follow_notification_insert after insert on public.user_follows
for each row execute procedure public.create_follow_notification();

-- Publication enables live recipient notification updates when configured.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end
$$;
