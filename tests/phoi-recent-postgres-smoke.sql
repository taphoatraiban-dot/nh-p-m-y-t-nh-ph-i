-- Run only against the disposable PostgreSQL service in GitHub Actions.
\set ON_ERROR_STOP on
create schema auth;
create role anon nologin;
create role authenticated nologin;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
$$;
\ir ../supabase/migrations/20261104_phoi_recent_backups_draft.sql
insert into auth.users(id) values
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002');
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
insert into public.phoi_recent_backups(owner_user_id,receipt_id,receipt_day,receipt_snapshot)
values ('00000000-0000-0000-0000-000000000001','receipt-ok',(now() at time zone 'Asia/Ho_Chi_Minh')::date,
 jsonb_build_object('id','receipt-ok','created_at',now()::text));
do $$
begin
 if (select count(*) from public.phoi_recent_backups) <> 1 then raise exception 'owner read failed';end if;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
do $$
begin
 if exists(select 1 from public.phoi_recent_backups where receipt_id='receipt-ok') then
  raise exception 'RLS leaked another account receipt';
 end if;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
insert into public.phoi_recent_backup_deletions(owner_user_id,receipt_id)
values ('00000000-0000-0000-0000-000000000001','deleted-before-upload');
do $$
begin
 begin
  insert into public.phoi_recent_backups(owner_user_id,receipt_id,receipt_day,receipt_snapshot)
  values ('00000000-0000-0000-0000-000000000001','deleted-before-upload',
  (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  jsonb_build_object('id','deleted-before-upload','created_at',now()::text));
  raise exception 'Tombstone failed to block upload';
 exception when others then
  if sqlerrm = 'Tombstone failed to block upload' then raise; end if;
 end;
end $$;

-- The second account must not be able to insert or read the first account data.
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
do $$
begin
 begin
  insert into public.phoi_recent_backups(owner_user_id,receipt_id,receipt_day,receipt_snapshot)
  values ('00000000-0000-0000-0000-000000000001','forged-owner',
   (now() at time zone 'Asia/Ho_Chi_Minh')::date,
   jsonb_build_object('id','forged-owner','created_at',now()::text));
  raise exception 'Cross-account insert unexpectedly succeeded';
 exception when others then
  if sqlerrm='Cross-account insert unexpectedly succeeded' then raise;end if;
 end;
end $$;
-- The second account must not be able to forge deletion markers for another owner.
do $$
begin
 begin
  insert into public.phoi_recent_backup_deletions(owner_user_id,receipt_id)
  values ('00000000-0000-0000-0000-000000000001','receipt-ok');
  raise exception 'Cross-account delete marker unexpectedly succeeded';
 exception when others then
  if sqlerrm='Cross-account delete marker unexpectedly succeeded' then raise;end if;
 end;
end $$;

-- Owner B cannot overwrite owner A's existing receipt, even with a valid ID.
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
do $$
declare affected integer;
begin
 update public.phoi_recent_backups
 set receipt_snapshot=jsonb_build_object('id','receipt-ok','created_at',now()::text)
 where owner_user_id='00000000-0000-0000-0000-000000000001'
 and receipt_id='receipt-ok';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Cross-account update unexpectedly succeeded';end if;
end $$;
-- Owner A cannot submit a forged receipt_day that differs from created_at.
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
do $$
begin
 begin
  insert into public.phoi_recent_backups(owner_user_id,receipt_id,receipt_day,receipt_snapshot)
  values ('00000000-0000-0000-0000-000000000001','forged-day',
   ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 1),
   jsonb_build_object('id','forged-day','created_at',now()::text));
  raise exception 'Forged receipt day unexpectedly succeeded';
 exception when others then
  if sqlerrm='Forged receipt day unexpectedly succeeded' then raise;end if;
 end;
end $$;
