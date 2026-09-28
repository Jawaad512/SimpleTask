-- A holding area for deleted rows.
--
-- Postgres deletes are final, and on 2026-09-28 a script deleted every row this
-- account had. Nothing was recoverable. This makes the next one recoverable:
-- every delete on a data table copies the whole row into `deleted_rows` first,
-- and it sits there until someone puts it back or purges it.
--
-- The important part is that the owner cannot empty this table. Rows go in
-- through a security-definer trigger, the owner has `select` and nothing else,
-- and there is no delete policy at all. So the same runaway script that emptied
-- every other table cannot reach its own wreckage.
--
-- Additive and idempotent, like every migration here.

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------

create table if not exists public.deleted_rows (
  id          bigint generated always as identity primary key,
  -- Nullable only for the task_tags edge case below; every other row has one.
  user_id     uuid,
  table_name  text not null,
  row_data    jsonb not null,
  deleted_at  timestamptz not null default now()
);

create index if not exists deleted_rows_user_time_idx
  on public.deleted_rows (user_id, deleted_at desc);

create index if not exists deleted_rows_table_idx
  on public.deleted_rows (user_id, table_name, deleted_at desc);

-- ---------------------------------------------------------------------------
-- 2. The trigger
--
-- `security definer` so the insert bypasses the RLS below — the whole point is
-- that the client's own privileges do not govern what gets archived.
--
-- task_tags is the awkward one: it carries no user_id, and it cascades from
-- both parents. Whichever parent is being deleted is already gone by the time
-- this fires, so we ask the other one. Only a delete that takes both parents in
-- the same statement leaves it unattributed.
-- ---------------------------------------------------------------------------

create or replace function public.archive_deleted_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_row  jsonb := to_jsonb(old);
begin
  if v_row ? 'user_id' then
    v_user := (v_row ->> 'user_id')::uuid;
  else
    select coalesce(
             (select t.user_id from public.tasks t where t.id = (v_row ->> 'task_id')::uuid),
             (select g.user_id from public.tags  g where g.id = (v_row ->> 'tag_id')::uuid)
           )
      into v_user;
  end if;

  insert into public.deleted_rows (user_id, table_name, row_data)
  values (v_user, tg_table_name, v_row);

  return old;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'habits', 'tags', 'deadlines', 'categories', 'task_tags']
  loop
    execute format('drop trigger if exists %I on public.%I', 'archive_' || t, t);
    execute format(
      'create trigger %I before delete on public.%I
         for each row execute function public.archive_deleted_row()',
      'archive_' || t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RLS — readable by its owner, writable by nobody
--
-- No insert, update or delete policy is declared on purpose. With RLS enabled
-- and no policy, those commands are denied outright; the trigger above is the
-- only way in.
-- ---------------------------------------------------------------------------

alter table public.deleted_rows enable row level security;

drop policy if exists deleted_rows_owner_select on public.deleted_rows;

create policy deleted_rows_owner_select on public.deleted_rows
  for select using (auth.uid() = user_id);

revoke all on public.deleted_rows from anon, authenticated;
grant select on public.deleted_rows to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Putting rows back
--
-- `security invoker`, so the ordinary owner policies still decide what may be
-- written — this restores your rows, never anyone else's. `on conflict do
-- nothing` with no target so it works for task_tags, whose key is composite.
--
-- Restore in foreign-key order: categories and tags before the rows that
-- reference them, tasks before task_tags.
-- ---------------------------------------------------------------------------

create or replace function public.restore_deleted_rows(
  p_table text,
  p_since timestamptz
)
returns int
language plpgsql
set search_path = public
as $$
declare
  rec     record;
  v_count int := 0;
begin
  if p_table not in ('tasks', 'habits', 'tags', 'deadlines', 'categories', 'task_tags') then
    raise exception 'refusing to restore into %', p_table;
  end if;

  for rec in
    select row_data
    from public.deleted_rows
    where table_name = p_table
      and deleted_at >= p_since
      and user_id = auth.uid()
    order by deleted_at asc
  loop
    execute format(
      'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)
         on conflict do nothing',
      p_table, p_table)
    using rec.row_data;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Purging — deliberately absent
--
-- There is no purge function, and that is the point. Anything the client can
-- call, a script running as the client can call by mistake; an archive with a
-- one-line empty button is not an archive. At this app's volume it is a few
-- thousand small rows a year, which is nothing.
--
-- If it ever does need trimming, do it from the dashboard SQL editor, where the
-- service role bypasses the policy above:
--
--   delete from public.deleted_rows where deleted_at < now() - interval '1 year';
-- ---------------------------------------------------------------------------
