-- §7 day rollover, plus the §6.3 twenty-four-hour purge.
--
-- One function, one transaction, called with the browser's local date. The row
-- lock on user_settings is what stops a slow network running it twice.

create or replace function public.run_daily_rollover(p_local_date date)
returns table (
  did_run          boolean,
  carried_over     int,
  habits_cleared   int,
  completed_purged int
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_last    date;
  v_carried int := 0;
  v_habits  int := 0;
  v_purged  int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.user_settings (user_id, last_rollover_on)
  values (v_uid, null)
  on conflict (user_id) do nothing;

  -- Serialise concurrent callers on this user's settings row.
  select last_rollover_on
    into v_last
  from public.user_settings
  where user_id = v_uid
  for update;

  -- Already rolled today (or the clock went backwards): do nothing at all.
  if v_last is not null and v_last >= p_local_date then
    return query select false, 0, 0, 0;
    return;
  end if;

  -- The 24-hour purge runs on every rollover pass, including the first one.
  delete from public.tasks
  where user_id = v_uid
    and status = 'done'
    and completed_at < now() - interval '24 hours';
  get diagnostics v_purged = row_count;

  if v_last is null then
    -- Bootstrap: no previous day to carry anything over from. Just record today.
    update public.user_settings
       set last_rollover_on = p_local_date
     where user_id = v_uid;

    return query select true, 0, 0, v_purged;
    return;
  end if;

  -- 1. Everything still sitting in the top row accumulates a carry-over.
  --    Habit instances are excluded — they are cleared, not carried.
  update public.tasks
     set carry_over_count = carry_over_count + 1
   where user_id = v_uid
     and status = 'active'
     and is_today
     and not is_ephemeral;
  get diagnostics v_carried = row_count;

  -- 2. Habit instances do not survive the day boundary.
  delete from public.tasks
   where user_id = v_uid
     and status = 'active'
     and is_ephemeral;
  get diagnostics v_habits = row_count;

  -- 3. Stamp the date in the same transaction.
  update public.user_settings
     set last_rollover_on = p_local_date
   where user_id = v_uid;

  return query select true, v_carried, v_habits, v_purged;
end;
$$;

revoke all on function public.run_daily_rollover(date) from public;
grant execute on function public.run_daily_rollover(date) to authenticated;
