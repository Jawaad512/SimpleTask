-- Estimated durations, habit scheduling days, and fifteen colour slots.
--
-- Additive throughout: every new column is nullable or defaulted, so rows that
-- predate this migration keep working untouched.

-- ---------------------------------------------------------------------------
-- 1. tasks.estimated_minutes
--
-- Null means "not estimated" — the card shows nothing and the task drags
-- anywhere, exactly as before. Once set, the estimate owns the effort axis:
-- under 20 minutes is the left column, under 5 minutes is the flag. That rule
-- lives in the trigger below so it holds whatever writes the row.
-- ---------------------------------------------------------------------------

alter table public.tasks
  add column if not exists estimated_minutes int;

alter table public.tasks
  drop constraint if exists tasks_estimated_minutes_range;

alter table public.tasks
  add constraint tasks_estimated_minutes_range
  check (estimated_minutes is null or estimated_minutes between 1 and 1440);

-- ---------------------------------------------------------------------------
-- 2. habits: an estimate of their own, plus the days they place themselves
--
-- `days` is a seven-bit mask, bit 0 = Sunday through bit 6 = Saturday, to match
-- JavaScript's Date#getDay(). Zero means the habit is manual only.
--
-- `last_spawn_on` is what keeps the auto-placement idempotent: once a habit has
-- placed itself for a date it will not do so again, so removing it from the
-- board by hand stays removed for the rest of that day.
-- ---------------------------------------------------------------------------

alter table public.habits
  add column if not exists estimated_minutes int;

alter table public.habits
  drop constraint if exists habits_estimated_minutes_range;

alter table public.habits
  add constraint habits_estimated_minutes_range
  check (estimated_minutes is null or estimated_minutes between 1 and 1440);

alter table public.habits
  add column if not exists days int not null default 0;

alter table public.habits
  drop constraint if exists habits_days_range;

alter table public.habits
  add constraint habits_days_range check (days between 0 and 127);

alter table public.habits
  add column if not exists last_spawn_on date;

-- ---------------------------------------------------------------------------
-- 3. Fifteen colour slots rather than ten
--
-- The unique (user_id, color_slot) constraint is unchanged; only the range
-- widens, so the cap on categories rises with it.
-- ---------------------------------------------------------------------------

alter table public.categories
  drop constraint if exists categories_color_slot_check;

alter table public.categories
  drop constraint if exists categories_color_slot_range;

alter table public.categories
  add constraint categories_color_slot_range check (color_slot between 1 and 15);

create or replace function public.set_category_slot(p_category uuid, p_slot int)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_current int;
  v_other   uuid;
begin
  if p_slot < 1 or p_slot > 15 then
    raise exception 'colour slot must be between 1 and 15';
  end if;

  select color_slot into v_current
  from categories
  where id = p_category and user_id = v_uid
  for update;

  if v_current is null then
    raise exception 'category not found';
  end if;

  if v_current = p_slot then
    return;
  end if;

  select id into v_other
  from categories
  where user_id = v_uid and color_slot = p_slot
  for update;

  if v_other is null then
    update categories set color_slot = p_slot where id = p_category;
    return;
  end if;

  -- Both rows momentarily hold the same slot; the constraint is checked at commit.
  set constraints categories_user_slot_key deferred;
  update categories set color_slot = v_current where id = v_other;
  update categories set color_slot = p_slot     where id = p_category;
end;
$$;

revoke all on function public.set_category_slot(uuid, int) from public;
grant execute on function public.set_category_slot(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The estimate owns the effort axis
--
-- Replaces the trigger from the initial migration. When estimated_minutes is
-- null the old behaviour is preserved exactly; when it is set it decides
-- is_quick and is_instant, so a client that sends a contradictory pair — a
-- drag across the vertical divide, say — cannot put the row out of step with
-- the number printed on the card.
-- ---------------------------------------------------------------------------

create or replace function public.tasks_normalise_effort()
returns trigger
language plpgsql
as $$
begin
  if new.estimated_minutes is not null then
    new.is_quick   := new.estimated_minutes < 20;
    new.is_instant := new.estimated_minutes < 5;
  elsif tg_op = 'INSERT' then
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
-- 5. Rename a tag
--
-- The unique index is on lower(name), so a rename that collides with an
-- existing tag has to be a merge rather than a failure: the links move across
-- and the now-empty tag goes. One transaction, because a half-done merge would
-- lose task/tag links.
-- ---------------------------------------------------------------------------

create or replace function public.rename_tag(p_tag uuid, p_name text)
returns public.tags
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_name  text := btrim(p_name);
  v_other uuid;
  v_row   public.tags;
begin
  if v_name = '' then
    raise exception 'tag name is empty';
  end if;

  if not exists (select 1 from tags where id = p_tag and user_id = v_uid) then
    raise exception 'tag not found';
  end if;

  select id into v_other
  from tags
  where user_id = v_uid and lower(name) = lower(v_name) and id <> p_tag;

  if v_other is not null then
    -- Merge: move any link that the destination does not already hold, drop
    -- the rest, then retire the source tag.
    update task_tags tt
       set tag_id = v_other
     where tt.tag_id = p_tag
       and not exists (
         select 1 from task_tags other
         where other.tag_id = v_other and other.task_id = tt.task_id
       );

    delete from task_tags where tag_id = p_tag;
    delete from tags where id = p_tag and user_id = v_uid;

    update tags set name = v_name where id = v_other returning * into v_row;
    return v_row;
  end if;

  update tags set name = v_name where id = p_tag returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.rename_tag(uuid, text) from public;
grant execute on function public.rename_tag(uuid, text) to authenticated;
