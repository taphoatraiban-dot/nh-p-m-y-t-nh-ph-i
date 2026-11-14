-- Protect Telegram separately; basic entry/pricing/customer features keep their current rights.
begin;
create or replace function public.telegram_account_entitled(p_user_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select p_user_id is not null and (
  exists(select 1 from public.admin_users a where a.user_id=p_user_id)
  or exists(
   select 1 from public.profiles p join auth.users u on u.id=p.id
   where p.id=p_user_id and p.edition='pro' and
   case when u.email like 'phone-%@accounts.invalid' or u.raw_app_meta_data->>'cuncun_auth_type'='phone_password'
    then exists(select 1 from public.phone_auth_accounts a join public.licenses l on l.user_id=a.user_id where a.user_id=p_user_id and a.status='approved' and l.active and (l.expires_at is null or l.expires_at>now()))
    else exists(select 1 from public.email_licenses l where l.user_id=p_user_id and l.active and l.expires_at>now())
     or exists(select 1 from public.phone_auth_accounts a join public.licenses l on l.user_id=a.user_id where a.user_id=p_user_id and a.status='approved' and l.active and (l.expires_at is null or l.expires_at>now()))
   end
  )
 );
$$;
revoke all on function public.telegram_account_entitled(uuid) from public,anon,authenticated;
grant execute on function public.telegram_account_entitled(uuid) to service_role;
create or replace function public.telegram_feature_allowed()
returns boolean language sql stable security invoker set search_path='' as $$
 with permission as (select public.check_email_license()::jsonb p)
 select coalesce(auth.uid() is not null and p->>'success'='true' and p->>'active'='true' and (p->>'is_admin'='true' or p->>'edition'='pro'),false) from permission;
$$;
revoke all on function public.telegram_feature_allowed() from public,anon;
grant execute on function public.telegram_feature_allowed() to authenticated;
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'telegram\_%' escape '\' loop
  execute format('create policy telegram_pro_tier on public.%I as restrictive for all to authenticated using ((select public.telegram_feature_allowed())) with check ((select public.telegram_feature_allowed()))',t.tablename);
 end loop;
end $$;
CREATE OR REPLACE FUNCTION public.telegram_push_claim()
 RETURNS TABLE(job_id uuid, subscription_id uuid, endpoint text, p256dh text, auth_key text)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 insert into public.telegram_push_deliveries(subscription_id,chat_id,message_id)
 select s.id,m.chat_id,m.message_id
 from public.telegram_push_subscriptions s
 join public.telegram_chat_access a on a.user_id=s.user_id and a.enabled
 join public.telegram_member_messages m on m.user_id=s.user_id
   and m.message_date>=greatest(s.enabled_since-interval '5 seconds',now()-interval '10 minutes')
 join public.telegram_member_groups g on g.user_id=m.user_id and g.chat_id=m.chat_id and g.enabled
 where public.telegram_account_entitled(s.user_id) and s.enabled and m.received_at>=s.enabled_since and coalesce(m.sender_name,'')<>'Đã gửi'
   and m.message_text<>'' and m.chat_id not in (777000,42777)
   and not exists(select 1 from public.telegram_member_hidden h where h.user_id=m.user_id and h.chat_id=m.chat_id and h.message_id=m.message_id)
   and not exists(select 1 from public.telegram_push_deliveries d where d.subscription_id=s.id and d.chat_id=m.chat_id and d.message_id=m.message_id)
 order by m.message_date limit 1000 on conflict do nothing;
 return query
 with candidates as (
  select d.id from public.telegram_push_deliveries d
  join public.telegram_push_subscriptions s on s.id=d.subscription_id and s.enabled
  join public.telegram_chat_access a on a.user_id=s.user_id and a.enabled
  join public.telegram_member_messages m on m.user_id=s.user_id and m.chat_id=d.chat_id and m.message_id=d.message_id
  where public.telegram_account_entitled(s.user_id) and m.received_at>=s.enabled_since and d.attempts<5 and d.next_at<=now()
   and (d.state='queued' or (d.state='sending' and d.claimed_at<now()-interval '5 minutes'))
  order by d.next_at for update of d skip locked limit 20
 ), changed as (
  update public.telegram_push_deliveries d set state='sending',claimed_at=now(),attempts=attempts+1
  from candidates c where d.id=c.id returning d.id,d.subscription_id
 ) select c.id,c.subscription_id,s.endpoint,s.p256dh,s.auth_key
 from changed c join public.telegram_push_subscriptions s on s.id=c.subscription_id;
end $function$;
commit;
