-- Review and test on staging before applying to production.
create table if not exists public.phoi_recent_backups (
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 receipt_id text not null,
 receipt_day date not null,
 receipt_snapshot jsonb not null,
 deleted_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(owner_user_id,receipt_id)
);
create index if not exists phoi_recent_backups_day_idx on public.phoi_recent_backups(receipt_day);
alter table public.phoi_recent_backups enable row level security;
-- Data API table privileges and row ownership checks are separate controls.
revoke all on public.phoi_recent_backups from anon;
grant select, insert, update on public.phoi_recent_backups to authenticated;
-- Deletions are represented by owner-scoped tombstones, never by re-uploading old snapshots.
-- Validate receipt metadata server-side; never trust the browser's receipt_day.
create or replace function public.validate_phoi_recent_backup()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  snapshot_id text;
  snapshot_time timestamptz;
begin
  -- Serialize receipt operations across both tables for this account and ID.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.owner_user_id::text || ':' || new.receipt_id, 0)
  );
  if exists (
    select 1 from public.phoi_recent_backup_deletions d
    where d.owner_user_id=new.owner_user_id and d.receipt_id=new.receipt_id
  ) then
    raise exception 'Receipt has been deleted';
  end if;
  -- A tombstone is immutable: later stale backup upserts cannot resurrect it.
  if tg_op = 'UPDATE' and old.deleted_at is not null then
    new.deleted_at := old.deleted_at;
    new.receipt_snapshot := old.receipt_snapshot;
  end if;
  if new.deleted_at is not null and new.deleted_at > now() + interval '1 minute' then
    raise exception 'Invalid deletion timestamp';
  end if;
  snapshot_id := new.receipt_snapshot->>'id';
  if snapshot_id is null or length(trim(snapshot_id)) = 0 or snapshot_id <> new.receipt_id then
    raise exception 'Invalid receipt ID';
  end if;
  begin
    snapshot_time := (new.receipt_snapshot->>'created_at')::timestamptz;
  exception when others then
    raise exception 'Invalid receipt creation time';
  end;
  if snapshot_time is null or (snapshot_time at time zone 'Asia/Ho_Chi_Minh')::date <> new.receipt_day then
    raise exception 'Receipt date mismatch';
  end if;
  if new.receipt_day not in (
    (now() at time zone 'Asia/Ho_Chi_Minh')::date,
    (now() at time zone 'Asia/Ho_Chi_Minh')::date - 1
  ) then
    raise exception 'Receipt is outside backup retention window';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_phoi_recent_backup() from public, anon;
drop trigger if exists validate_phoi_recent_backup_trigger on public.phoi_recent_backups;
create trigger validate_phoi_recent_backup_trigger
before insert or update on public.phoi_recent_backups
for each row execute function public.validate_phoi_recent_backup();
create policy "owners_select_recent_phoi" on public.phoi_recent_backups for select to authenticated using (owner_user_id=auth.uid());
create policy "owners_insert_recent_phoi" on public.phoi_recent_backups for insert to authenticated with check (owner_user_id=auth.uid());
create policy "owners_update_recent_phoi" on public.phoi_recent_backups for update to authenticated using (owner_user_id=auth.uid()) with check (owner_user_id=auth.uid());
-- A server-side scheduled cleanup job is required to delete records older
-- than the previous Vietnam calendar day; do not rely on client-side deletion.

-- Deletion can precede the first upload. Keep a separate tombstone so a
-- delayed first upload cannot recreate a receipt the owner already removed.
create table if not exists public.phoi_recent_backup_deletions (
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 receipt_id text not null,
 deleted_at timestamptz not null default now(),
 primary key(owner_user_id,receipt_id)
);
alter table public.phoi_recent_backup_deletions enable row level security;
revoke all on public.phoi_recent_backup_deletions from anon;
grant select, insert on public.phoi_recent_backup_deletions to authenticated;
create policy "owners_select_recent_phoi_deletions" on public.phoi_recent_backup_deletions
 for select to authenticated using (owner_user_id=auth.uid());
create policy "owners_insert_recent_phoi_deletions" on public.phoi_recent_backup_deletions
 for insert to authenticated with check (owner_user_id=auth.uid());

-- Use the same transaction lock when inserting deletion markers, ensuring
-- a simultaneous backup cannot pass the check before deletion commits.
create or replace function public.lock_phoi_recent_deletion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.owner_user_id::text || ':' || new.receipt_id, 0)
  );
  return new;
end;
$;
revoke all on function public.lock_phoi_recent_deletion() from public, anon;
drop trigger if exists lock_phoi_recent_deletion_trigger on public.phoi_recent_backup_deletions;
create trigger lock_phoi_recent_deletion_trigger
before insert on public.phoi_recent_backup_deletions
for each row execute function public.lock_phoi_recent_deletion();

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
