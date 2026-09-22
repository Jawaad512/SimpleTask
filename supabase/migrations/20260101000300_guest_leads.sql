-- Guest-demo leads. Anyone can write; only the first (owner) account can read.

create or replace function public.is_app_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and auth.uid() = (
       select id from auth.users
       order by created_at asc
       limit 1
     );
$$;

revoke all on function public.is_app_owner() from public;
grant execute on function public.is_app_owner() to authenticated;

-- ---------------------------------------------------------------------------
-- Interest emails
-- ---------------------------------------------------------------------------

create table if not exists public.guest_interest (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (
                length(btrim(email)) between 3 and 254
                and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
              ),
  created_at  timestamptz not null default now()
);

create unique index if not exists guest_interest_email_key
  on public.guest_interest (lower(email));

alter table public.guest_interest enable row level security;

drop policy if exists guest_interest_insert on public.guest_interest;
create policy guest_interest_insert on public.guest_interest
  for insert to anon, authenticated
  with check (true);

drop policy if exists guest_interest_select on public.guest_interest;
create policy guest_interest_select on public.guest_interest
  for select to authenticated
  using (public.is_app_owner());

drop policy if exists guest_interest_delete on public.guest_interest;
create policy guest_interest_delete on public.guest_interest
  for delete to authenticated
  using (public.is_app_owner());

-- ---------------------------------------------------------------------------
-- Free-form feedback
-- ---------------------------------------------------------------------------

create table if not exists public.guest_feedback (
  id          uuid primary key default gen_random_uuid(),
  message     text not null check (length(btrim(message)) between 1 and 2000),
  email       text check (
                email is null
                or (
                  length(btrim(email)) between 3 and 254
                  and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
                )
              ),
  created_at  timestamptz not null default now()
);

alter table public.guest_feedback enable row level security;

drop policy if exists guest_feedback_insert on public.guest_feedback;
create policy guest_feedback_insert on public.guest_feedback
  for insert to anon, authenticated
  with check (true);

drop policy if exists guest_feedback_select on public.guest_feedback;
create policy guest_feedback_select on public.guest_feedback
  for select to authenticated
  using (public.is_app_owner());

drop policy if exists guest_feedback_delete on public.guest_feedback;
create policy guest_feedback_delete on public.guest_feedback
  for delete to authenticated
  using (public.is_app_owner());

grant insert on public.guest_interest to anon, authenticated;
grant select, delete on public.guest_interest to authenticated;

grant insert on public.guest_feedback to anon, authenticated;
grant select, delete on public.guest_feedback to authenticated;

notify pgrst, 'reload schema';
