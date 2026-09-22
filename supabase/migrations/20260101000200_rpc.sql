-- Operations that must be one transaction, and therefore cannot be assembled
-- from separate PostgREST calls.

-- ---------------------------------------------------------------------------
-- Recolour. Moving into a free slot is a plain update; picking an occupied one
-- swaps the two categories, which §5 says to offer rather than block.
-- ---------------------------------------------------------------------------

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
  if p_slot < 1 or p_slot > 10 then
    raise exception 'colour slot must be between 1 and 10';
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

-- ---------------------------------------------------------------------------
-- Reorder. The array is the new display order, front to back.
-- ---------------------------------------------------------------------------

create or replace function public.reorder_categories(p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  update categories c
     set position = ordered.idx
    from (select id, (ordinality - 1)::int as idx
            from unnest(p_ids) with ordinality as t(id, ordinality)) as ordered
   where c.id = ordered.id
     and c.user_id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Delete, optionally moving dependants first. Never silently reassigns and
-- never cascades into tasks — the caller has to name the destination.
-- ---------------------------------------------------------------------------

create or replace function public.delete_category(p_category uuid, p_move_to uuid default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_tasks int;
  v_habit int;
begin
  if p_category = p_move_to then
    raise exception 'cannot move a category into itself';
  end if;

  if p_move_to is not null then
    if not exists (select 1 from categories where id = p_move_to and user_id = v_uid) then
      raise exception 'destination category not found';
    end if;

    update tasks  set category_id = p_move_to where category_id = p_category and user_id = v_uid;
    update habits set category_id = p_move_to where category_id = p_category and user_id = v_uid;
  end if;

  select count(*) into v_tasks from tasks  where category_id = p_category and user_id = v_uid;
  select count(*) into v_habit from habits where category_id = p_category and user_id = v_uid;

  if v_tasks > 0 or v_habit > 0 then
    raise exception 'category still has % task(s) and % habit(s)', v_tasks, v_habit;
  end if;

  delete from categories where id = p_category and user_id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Create-or-fetch a tag by case-insensitive name, matching the expression index.
-- ---------------------------------------------------------------------------

create or replace function public.upsert_tag(p_name text)
returns public.tags
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := btrim(p_name);
  v_row  public.tags;
begin
  if v_name = '' then
    raise exception 'tag name is empty';
  end if;

  select * into v_row from tags where user_id = v_uid and lower(name) = lower(v_name);
  if found then
    return v_row;
  end if;

  insert into tags (user_id, name) values (v_uid, v_name) returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.set_category_slot(uuid, int)   from public;
revoke all on function public.reorder_categories(uuid[])     from public;
revoke all on function public.delete_category(uuid, uuid)    from public;
revoke all on function public.upsert_tag(text)               from public;

grant execute on function public.set_category_slot(uuid, int) to authenticated;
grant execute on function public.reorder_categories(uuid[])   to authenticated;
grant execute on function public.delete_category(uuid, uuid)  to authenticated;
grant execute on function public.upsert_tag(text)             to authenticated;
