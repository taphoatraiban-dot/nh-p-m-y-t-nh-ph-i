-- Archive changes visibility only; QR identity and settlement history are retained.
begin;
alter table public.receipt_verifications add column if not exists archived_at timestamptz;
create index if not exists receipt_verifications_owner_archive_idx
  on public.receipt_verifications (owner_user_id, archived_at desc, id desc)
  where archived_at is not null;

-- Also protect settled records from an older API deployment or direct DELETE.
-- SECURITY INVOKER: the trigger does not elevate the caller's privileges.
create or replace function public.receipt_keep_settled_history()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.status = 'redeemed' and (tg_op = 'DELETE' or
      (to_jsonb(new) - 'archived_at') is distinct from (to_jsonb(old) - 'archived_at')) then
    raise exception 'Settled receipt history must be retained; archive the receipt instead'
      using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.receipt_keep_settled_history() from public;
drop trigger if exists receipt_keep_settled_history on public.receipt_verifications;
create trigger receipt_keep_settled_history before update or delete on public.receipt_verifications
  for each row execute function public.receipt_keep_settled_history();
commit;
