-- SimpleTask — schema, constraints and row level security.
-- Single-user app: every table is scoped to auth.uid().

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 40),
  color_slot  int  not null check (color_slot between 1 and 10),
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  -- One slot, one category: this is what makes a border colour unambiguous,
  -- and it is why a user can hold at most ten categories. Deferrable so that
  -- set_category_slot() can swap two categories inside one transaction.
  constraint categories_user_slot_key unique (user_id, color_slot) deferrable initially immediate
);

create index if not exists categories_user_position_idx
  on public.categories (user_id, position);

-- ---------------------------------------------------------------------------
-- habits (declared before tasks: tasks carries habit_id)
-- ---------------------------------------------------------------------------

create table if not exists public.habits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null check (length(btrim(title)) between 1 and 200),
  category_id  uuid not null references public.categories (id) on delete restrict,
  is_quick     boolean not null default true,
  position     int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists habits_user_position_idx
  on public.habits (user_id, position);

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  title             text not null check (length(btrim(title)) between 1 and 200),
  category_id       uuid not null references public.categories (id) on delete restrict,
  is_quick          boolean not null default true,
  is_today          boolean not null default true,
  is_instant        boolean not null default false,
  status            text not null default 'active' check (status in ('active', 'done')),
  completed_at      timestamptz,
  carry_over_count  int not null default 0 check (carry_over_count >= 0),
  habit_id          uuid references public.habits (id) on delete set null,
  is_ephemeral      boolean not null default false,
  position          double precision not null default 0,
  created_at        timestamptz not null default now(),

  -- §8: the flag only means anything on a sub-20-minute task.
  constraint tasks_instant_implies_quick check (not is_instant or is_quick),
  constraint tasks_completed_at_matches_status check (
    (status = 'done' and completed_at is not null)
    or (status = 'active' and completed_at is null)
  )
);

create index if not exists tasks_board_idx
  on public.tasks (user_id, status, is_today, is_quick, position);

create index if not exists tasks_done_idx
  on public.tasks (user_id, status, completed_at desc);

-- Keep is_instant and is_quick coherent no matter which client wrote the row.
-- Clearing is_quick clears is_instant in the same write; setting is_instant
-- forces is_quick.
create or replace function public.tasks_normalise_effort()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_instant then
      new.is_quick := true;
    end if;
  else
    if old.is_quick and not new.is_quick then
      new.is_instant := false;
    elsif new.is_instant and not old.is_instant then
      new.is_quick := true;
    elsif new.is_instant and not new.is_quick then
      new.is_instant := false;
    end if;
  end if;

  if new.status = 'active' then
    new.completed_at := null;
  elsif new.completed_at is null then
    new.completed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_normalise_effort_biu on public.tasks;
create trigger tasks_normalise_effort_biu
  before insert or update on public.tasks
  for each row execute function public.tasks_normalise_effort();

-- ---------------------------------------------------------------------------
-- tags + task_tags
-- ---------------------------------------------------------------------------

create table if not exists public.tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 32),
  created_at  timestamptz not null default now()
);

-- A plain table constraint cannot call lower(); this has to be an expression index.
create unique index if not exists tags_user_lower_name_key
  on public.tags (user_id, lower(name));

create table if not exists public.task_tags (
  task_id uuid not null references public.tasks (id) on delete cascade,
  tag_id  uuid not null references public.tags (id) on delete cascade,
  primary key (task_id, tag_id)
);

create index if not exists task_tags_tag_idx on public.task_tags (tag_id);

-- ---------------------------------------------------------------------------
-- deadlines — standalone reference items, never tasks
-- ---------------------------------------------------------------------------

create table if not exists public.deadlines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (length(btrim(title)) between 1 and 200),
  due_date    date not null,
  created_at  timestamptz not null default now()
);

create index if not exists deadlines_user_due_idx
  on public.deadlines (user_id, due_date);

-- ---------------------------------------------------------------------------
-- user_settings — exists only to make the day rollover idempotent
-- ---------------------------------------------------------------------------

create table if not exists public.user_settings (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  last_rollover_on  date
);

-- ---------------------------------------------------------------------------
-- Row level security. Enabled on every table, join table included — an
-- unpoliced join table is a real hole, not a formality.
-- ---------------------------------------------------------------------------

alter table public.categories    enable row level security;
alter table public.habits        enable row level security;
alter table public.tasks         enable row level security;
alter table public.tags          enable row level security;
alter table public.task_tags     enable row level security;
alter table public.deadlines     enable row level security;
alter table public.user_settings enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['categories', 'habits', 'tasks', 'tags', 'deadlines']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_owner_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_owner_delete', t);

    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id)',
      t || '_owner_select', t);
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id)',
      t || '_owner_insert', t);
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || '_owner_update', t);
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id)',
      t || '_owner_delete', t);
  end loop;
end;
$$;

-- user_settings is keyed on user_id rather than carrying one.
drop policy if exists user_settings_owner_select on public.user_settings;
drop policy if exists user_settings_owner_insert on public.user_settings;
drop policy if exists user_settings_owner_update on public.user_settings;
drop policy if exists user_settings_owner_delete on public.user_settings;

create policy user_settings_owner_select on public.user_settings
  for select using (auth.uid() = user_id);
create policy user_settings_owner_insert on public.user_settings
  for insert with check (auth.uid() = user_id);
create policy user_settings_owner_update on public.user_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy user_settings_owner_delete on public.user_settings
  for delete using (auth.uid() = user_id);

-- task_tags has no user_id of its own; police it through its parent task.
drop policy if exists task_tags_owner_select on public.task_tags;
drop policy if exists task_tags_owner_insert on public.task_tags;
drop policy if exists task_tags_owner_update on public.task_tags;
drop policy if exists task_tags_owner_delete on public.task_tags;

create policy task_tags_owner_select on public.task_tags
  for select using (
    exists (select 1 from public.tasks t where t.id = task_tags.task_id and t.user_id = auth.uid())
  );

create policy task_tags_owner_insert on public.task_tags
  for insert with check (
    exists (select 1 from public.tasks t where t.id = task_tags.task_id and t.user_id = auth.uid())
    and exists (select 1 from public.tags g where g.id = task_tags.tag_id and g.user_id = auth.uid())
  );

create policy task_tags_owner_update on public.task_tags
  for update using (
    exists (select 1 from public.tasks t where t.id = task_tags.task_id and t.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.tasks t where t.id = task_tags.task_id and t.user_id = auth.uid())
    and exists (select 1 from public.tags g where g.id = task_tags.tag_id and g.user_id = auth.uid())
  );

create policy task_tags_owner_delete on public.task_tags
  for delete using (
    exists (select 1 from public.tasks t where t.id = task_tags.task_id and t.user_id = auth.uid())
  );
