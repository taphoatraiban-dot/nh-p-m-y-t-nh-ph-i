begin;
create table public.telegram_push_config (
 singleton boolean primary key default true check(singleton),
 public_key text not null,
 dispatcher_hash text not null check(length(dispatcher_hash)=64)
);
create table public.telegram_push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique, p256dh text not null, auth_key text not null,
 enabled boolean not null default true,
 enabled_since timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index telegram_push_subscriptions_users on public.telegram_push_subscriptions(user_id) where enabled;
create table public.telegram_push_deliveries (
 id uuid primary key default gen_random_uuid(),
 subscription_id uuid not null references public.telegram_push_subscriptions(id) on delete cascade,
 chat_id bigint not null, message_id bigint not null,
 state text not null default 'queued' check(state in ('queued','sending','sent','expired')),
 attempts integer not null default 0, next_at timestamptz not null default now(), claimed_at timestamptz,
 unique(subscription_id,chat_id,message_id)
);
create index telegram_push_deliveries_pending on public.telegram_push_deliveries(next_at) where state in ('queued','sending');
-- Only server-side endpoints access subscription secrets; never the public Data API.
alter table public.telegram_push_config enable row level security;
alter table public.telegram_push_subscriptions enable row level security;
alter table public.telegram_push_deliveries enable row level security;
revoke all on public.telegram_push_config,public.telegram_push_subscriptions,public.telegram_push_deliveries from public,anon,authenticated;
grant all on public.telegram_push_config,public.telegram_push_subscriptions,public.telegram_push_deliveries to service_role;
create policy service_push_config on public.telegram_push_config to service_role using(true) with check(true);
create policy service_push_subscriptions on public.telegram_push_subscriptions to service_role using(true) with check(true);
create policy service_push_deliveries on public.telegram_push_deliveries to service_role using(true) with check(true);
create function public.telegram_push_claim()
returns table(job_id uuid,subscription_id uuid,endpoint text,p256dh text,auth_key text)
language plpgsql security invoker set search_path='' as $$
begin
 insert into public.telegram_push_deliveries(subscription_id,chat_id,message_id)
 select s.id,m.chat_id,m.message_id
 from public.telegram_push_subscriptions s
 join public.telegram_chat_access a on a.user_id=s.user_id and a.enabled
 join public.telegram_member_messages m on m.user_id=s.user_id
   and m.message_date>=greatest(s.enabled_since-interval '5 seconds',now()-interval '10 minutes')
 join public.telegram_member_groups g on g.user_id=m.user_id and g.chat_id=m.chat_id and g.enabled
 where s.enabled and m.received_at>=s.enabled_since and coalesce(m.sender_name,'')<>'Đã gửi'
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
  where m.received_at>=s.enabled_since and d.attempts<5 and d.next_at<=now()
   and (d.state='queued' or (d.state='sending' and d.claimed_at<now()-interval '5 minutes'))
  order by d.next_at for update of d skip locked limit 20
 ), changed as (
  update public.telegram_push_deliveries d set state='sending',claimed_at=now(),attempts=attempts+1
  from candidates c where d.id=c.id returning d.id,d.subscription_id
 ) select c.id,c.subscription_id,s.endpoint,s.p256dh,s.auth_key
 from changed c join public.telegram_push_subscriptions s on s.id=c.subscription_id;
end $$;
revoke all on function public.telegram_push_claim() from public,anon,authenticated;
grant execute on function public.telegram_push_claim() to service_role;
commit;
