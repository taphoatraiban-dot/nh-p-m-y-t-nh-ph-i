-- Review and test on staging before applying to production.
create table if not exists public.phoi_recent_backups (
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 receipt_id text not null,
 receipt_day date not null,
 receipt_snapshot jsonb not null,
 updated_at timestamptz not null default now(),
 primary key(owner_user_id,receipt_id)
);
create index if not exists phoi_recent_backups_day_idx on public.phoi_recent_backups(receipt_day);
alter table public.phoi_recent_backups enable row level security;
create policy "owners_select_recent_phoi" on public.phoi_recent_backups for select to authenticated using (owner_user_id=auth.uid());
create policy "owners_insert_recent_phoi" on public.phoi_recent_backups for insert to authenticated with check (owner_user_id=auth.uid());
create policy "owners_update_recent_phoi" on public.phoi_recent_backups for update to authenticated using (owner_user_id=auth.uid()) with check (owner_user_id=auth.uid());
-- A server-side scheduled cleanup job is required to delete records older
-- than the previous Vietnam calendar day; do not rely on client-side deletion.

-- Cleanup is a separate, explicit server-side operation. Run only after staging verification.
-- Vietnam calendar date is derived from the server clock, not the client device.
create or replace function public.purge_expired_phoi_recent_backups()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare removed bigint;
begin
  delete from public.phoi_recent_backups
   where receipt_day < ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1);
  get diagnostics removed = row_count;
  return removed;
end;
$$;
revoke all on function public.purge_expired_phoi_recent_backups() from public, anon, authenticated;
-- Schedule this function via an approved server-side cron after the migration is reviewed.
