-- REVIEW ONLY. Never execute on production without separate SQL approval.
-- Requires admin_customer_commands table from the proposed command migration.
begin;

create function public.admin_customer_audit(p_user_id uuid, p_limit integer default 30)
returns table (
  actor_id uuid,
  action text,
  reason text,
  occurred_at timestamptz,
  result_revision bigint
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  ) then
    raise exception 'Không có quyền Admin' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'Thiếu mã khách hàng' using errcode = '22023';
  end if;
  return query
    select c.actor_id, c.action, c.reason, c.created_at, c.result_revision
    from public.admin_customer_commands c
    where c.user_id = p_user_id and c.result_revision is not null
    order by c.created_at desc, c.request_id desc
    limit least(greatest(coalesce(p_limit,30),1),100);
end;
$function$;

revoke all on function public.admin_customer_audit(uuid,integer)
  from public, anon, authenticated;
grant execute on function public.admin_customer_audit(uuid,integer)
  to authenticated;

-- The unmodified review file never leaves a persistent function behind.
rollback;
