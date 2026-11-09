begin;
create extension if not exists pgcrypto with schema extensions;
create table public.telegram_chat_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,
 worker_seen_at timestamptz
);
alter table public.telegram_chat_access enable row level security;
revoke all on public.telegram_chat_access from public,anon,authenticated;
grant all on public.telegram_chat_access to service_role;
-- Service-only tables: the Edge Function checks auth user + PIN ticket.
create table public.telegram_chat_pins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 pin_hash text not null, failures integer not null default 0,
 blocked_until timestamptz, ticket_hash text, expires_at timestamptz
);
create table public.telegram_chat_outbox (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 chat_id bigint not null, message_text text not null check(length(message_text) between 1 and 4096),
 state text not null default 'queued' check(state in ('queued','sending','sent','failed')),
 created_at timestamptz not null default now(), claimed_at timestamptz,
 message_id bigint, error text,
 foreign key(user_id,chat_id) references public.telegram_member_groups(user_id,chat_id)
);
create index telegram_chat_outbox_pending on public.telegram_chat_outbox(user_id,created_at) where state in ('queued','sending');
alter table public.telegram_chat_pins enable row level security;
alter table public.telegram_chat_outbox enable row level security;
revoke all on public.telegram_chat_pins,public.telegram_chat_outbox from public,anon,authenticated;
grant all on public.telegram_chat_pins,public.telegram_chat_outbox to service_role;
-- Row lock makes failure counting and first PIN creation safe under concurrency.
create function public.telegram_chat_unlock(p_user uuid,p_pin text,p_ticket_hash text,p_create boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.telegram_chat_pins; begin
 if p_pin !~ '^[0-9]{4}$' or length(p_ticket_hash)<>64 then return jsonb_build_object('success',false,'error','PIN phải gồm 4 số'); end if;
 if p_create then
  insert into public.telegram_chat_pins(user_id,pin_hash) values(p_user,extensions.crypt(p_pin,extensions.gen_salt('bf',10))) on conflict do nothing;
 end if;
 select * into r from public.telegram_chat_pins where user_id=p_user for update;
 if not found then return jsonb_build_object('success',false,'error','Chưa tạo PIN Chat'); end if;
 if r.blocked_until>now() then return jsonb_build_object('success',false,'error','Sai PIN nhiều lần. Thử lại sau 15 phút.'); end if;
 if extensions.crypt(p_pin,r.pin_hash)<>r.pin_hash then
  update public.telegram_chat_pins set failures=case when failures>=4 then 0 else failures+1 end,
   blocked_until=case when failures>=4 then now()+interval '15 minutes' else null end where user_id=p_user;
  return jsonb_build_object('success',false,'error','PIN chưa đúng');
 end if;
 update public.telegram_chat_pins set failures=0,blocked_until=null,ticket_hash=p_ticket_hash,expires_at=now()+interval '10 minutes' where user_id=p_user;
 return jsonb_build_object('success',true,'expires_in',600);
end $$;
create function public.telegram_chat_claim(p_user uuid)
returns setof public.telegram_chat_outbox language plpgsql security invoker set search_path='' as $$
begin
 update public.telegram_chat_access set worker_seen_at=now() where user_id=p_user and enabled and (worker_seen_at is null or worker_seen_at<now()-interval '1 minute');
 return query update public.telegram_chat_outbox set state='sending',claimed_at=now()
 where id in (select id from public.telegram_chat_outbox where user_id=p_user
 and (state='queued' or (state='sending' and claimed_at<now()-interval '2 minutes'))
 order by created_at for update skip locked limit 10) and exists(select 1 from public.telegram_chat_access where user_id=p_user and enabled) returning *;
end $$;
revoke all on function public.telegram_chat_unlock(uuid,text,text,boolean),public.telegram_chat_claim(uuid) from public,anon,authenticated;
grant execute on function public.telegram_chat_unlock(uuid,text,text,boolean),public.telegram_chat_claim(uuid) to service_role;
commit;
