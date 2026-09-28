-- The Future pane's scratch pad, moved off localStorage and onto the row.
--
-- It lived in localStorage, which meant every device had its own copy and none
-- of them agreed. `user_settings` is already one row per user and already
-- policed by RLS, so the note belongs there rather than in a table of its own.
--
-- Additive: the column is defaulted and not null, so rows that predate this
-- migration read as an empty pad rather than as null.

alter table public.user_settings
  add column if not exists future_notes text not null default '';

alter table public.user_settings
  drop constraint if exists user_settings_future_notes_length;

-- A scratch pad, not a document. The cap is generous enough never to be met by
-- hand and small enough that a paste accident cannot bloat the row.
alter table public.user_settings
  add constraint user_settings_future_notes_length
  check (length(future_notes) <= 20000);

-- Until now nothing but the rollover wrote this table, and the rollover always
-- inserted the row itself. The pad is written by a client upsert instead, so
-- the row has to be reachable from an insert the client performs — which the
-- init migration's owner_insert policy already allows. Nothing to add here;
-- this comment exists so the next reader does not go looking for it.
