-- STAGING ONLY: apply after 001 and 002. Never deploy without schema verification.
create table if not exists public.phone_subscription_orders (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('web_1m','web_3m','web_6m','web_12m')),
  amount_vnd bigint not null check (amount_vnd > 0),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid')),
  paid_at timestamptz,
  paid_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.phone_subscription_orders enable row level security;
revoke all on public.phone_subscription_orders from public, anon, authenticated;
grant all on public.phone_subscription_orders to service_role;

-- Atomic account/license/order provisioning, called only by the Edge Function
-- with service role. No client-supplied price or expiry is trusted.
create or replace function public.phone_auth_provision_signup(
 p_user_id uuid, p_phone text, p_plan_id text
) returns jsonb language plpgsql security definer set search_path to ''
as $$
declare v_months integer; v_amount bigint; v_expiry timestamptz;
begin
 if current_user <> 'service_role' and auth.role() <> 'service_role' then raise exception 'SERVICE_ONLY'; end if;
 select months, amount into v_months, v_amount from (
  values ('web_1m',1,799000::bigint),('web_3m',3,2290000::bigint),
         ('web_6m',6,4390000::bigint),('web_12m',12,7990000::bigint)
 ) as plans(plan,months,amount) where plan = p_plan_id;
 if v_months is null then raise exception 'INVALID_PLAN'; end if;
 if not exists (select 1 from auth.users where id=p_user_id and raw_app_meta_data->>'auth_method'='phone_alias') then
   raise exception 'INVALID_IDENTITY';
 end if;
 if exists(select 1 from public.phone_auth_accounts where user_id=p_user_id) then
   raise exception 'ALREADY_PROVISIONED';
 end if;
 -- Calendar-month addition: PostgreSQL clamps the last day automatically.
 v_expiry := now() + make_interval(months=>v_months);
 insert into public.phone_auth_accounts(user_id,phone_e164,status,approved_at)
 values(p_user_id,p_phone,'approved',now());
 insert into public.licenses(user_id,phone,activated_at,expires_at,active,note,updated_at)
 values(p_user_id,p_phone,now(),v_expiry,true,'WEB signup; payment pending',now());
 insert into public.phone_subscription_orders(user_id,plan_id,amount_vnd)
 values(p_user_id,p_plan_id,v_amount);
 return jsonb_build_object('success',true,'status','approved','expires_at',v_expiry,
   'plan_id',p_plan_id,'amount_vnd',v_amount,'payment_status','unpaid');
end;
$$;
revoke all on function public.phone_auth_provision_signup(uuid,text,text) from public,anon,authenticated;
grant execute on function public.phone_auth_provision_signup(uuid,text,text) to service_role;

-- Marking a transfer paid does not add months again: initial access already
-- began on signup. Renewals must be handled separately by admin workflow.
create or replace function public.phone_auth_mark_paid(p_admin_id uuid,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path to ''
as $$
declare v_order public.phone_subscription_orders%rowtype;
begin
 if current_user <> 'service_role' and auth.role() <> 'service_role' then raise exception 'SERVICE_ONLY'; end if;
 if not exists(select 1 from public.admin_users where user_id=p_admin_id) then raise exception 'ADMIN_REQUIRED'; end if;
 select * into v_order from public.phone_subscription_orders where user_id=p_user_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if v_order.payment_status='paid' then raise exception 'ALREADY_PAID'; end if;
 update public.phone_subscription_orders set payment_status='paid',paid_at=now(),paid_by=p_admin_id
 where user_id=p_user_id;
 return jsonb_build_object('success',true,'payment_status','paid','user_id',p_user_id);
end;
$$;
revoke all on function public.phone_auth_mark_paid(uuid,uuid) from public,anon,authenticated;
grant execute on function public.phone_auth_mark_paid(uuid,uuid) to service_role;

-- Separate renewal orders: preserve every payment and never extend a license twice.
create table if not exists public.phone_subscription_renewals (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_id text not null check (plan_id in ('web_1m','web_3m','web_6m','web_12m')),
 amount_vnd bigint not null check (amount_vnd > 0),
 expires_at_after timestamptz not null,
 payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid')),
 paid_at timestamptz,
 paid_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.phone_subscription_renewals enable row level security;
revoke all on public.phone_subscription_renewals from public,anon,authenticated;
grant all on public.phone_subscription_renewals to service_role;

create or replace function public.phone_auth_admin_renew(
 p_admin_id uuid,p_user_id uuid,p_plan_id text
) returns jsonb language plpgsql security definer set search_path to ''
as $$
declare v_months integer;v_amount bigint;v_license public.licenses%rowtype;v_base timestamptz;v_expiry timestamptz;v_order_id bigint;
begin
 if current_user <> 'service_role' and auth.role() <> 'service_role' then raise exception 'SERVICE_ONLY'; end if;
 if not exists(select 1 from public.admin_users where user_id=p_admin_id) then raise exception 'ADMIN_REQUIRED'; end if;
 select months,amount into v_months,v_amount from (
  values ('web_1m',1,799000::bigint),('web_3m',3,2290000::bigint),
  ('web_6m',6,4390000::bigint),('web_12m',12,7990000::bigint)
 ) as plans(plan,months,amount) where plan=p_plan_id;
 if v_months is null then raise exception 'INVALID_PLAN'; end if;
 if not exists(select 1 from public.phone_auth_accounts where user_id=p_user_id and status='approved') then
  raise exception 'ACCOUNT_NOT_APPROVED';
 end if;
 select * into v_license from public.licenses where user_id=p_user_id for update;
 if not found then raise exception 'LICENSE_NOT_FOUND'; end if;
 if v_license.expires_at is null then raise exception 'LIFETIME_LICENSE_UNCHANGED'; end if;
 v_base:=greatest(coalesce(v_license.expires_at,now()),now());
 v_expiry:=v_base+make_interval(months=>v_months);
 update public.licenses set expires_at=v_expiry,active=true,updated_at=now() where user_id=p_user_id;
 insert into public.phone_subscription_renewals(user_id,plan_id,amount_vnd,expires_at_after)
 values(p_user_id,p_plan_id,v_amount,v_expiry) returning id into v_order_id;
 return jsonb_build_object('success',true,'renewal_id',v_order_id,'expires_at',v_expiry,
  'amount_vnd',v_amount,'payment_status','unpaid');
end;
$$;
revoke all on function public.phone_auth_admin_renew(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.phone_auth_admin_renew(uuid,uuid,text) to service_role;
