-- STAGING ONLY: review before running on Supabase production.
-- Additive schema: does not update existing licenses, devices, profiles, or users.
create table if not exists public.ott_subscription_plans (
  code text primary key check (code in ('WEB','WEB_PRINT')),
  display_name text not null,
  available_for_sale boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.ott_subscription_prices (
  plan_code text not null references public.ott_subscription_plans(code),
  months integer not null check (months in (1,3,6,12)),
  price_vnd bigint not null check (price_vnd > 0),
  primary key (plan_code, months)
);
create table if not exists public.ott_customer_subscriptions (
  user_id uuid primary key references auth.users(id) on delete restrict,
  plan_code text not null references public.ott_subscription_plans(code),
  started_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'active' check (status in ('active','paused','expired')),
  max_concurrent_devices integer not null default 1 check (max_concurrent_devices = 1),
  updated_at timestamptz not null default now(),
  check (expires_at > started_at)
);
create table if not exists public.ott_subscription_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.ott_subscription_plans enable row level security;
alter table public.ott_subscription_prices enable row level security;
alter table public.ott_customer_subscriptions enable row level security;
alter table public.ott_subscription_audit enable row level security;
-- Intentionally no public access policies or grants until admin APIs are audited.
-- Do not automatically migrate legacy licenses or activate enforcement.
insert into public.ott_subscription_plans(code,display_name,available_for_sale)
values ('WEB','WEB tiêu chuẩn',false),('WEB_PRINT','WEB + IN cao cấp',false)
on conflict (code) do nothing;
insert into public.ott_subscription_prices(plan_code,months,price_vnd) values
('WEB',1,799000),('WEB',3,2290000),('WEB',6,4390000),('WEB',12,7990000),
('WEB_PRINT',1,1299000),('WEB_PRINT',3,3690000),('WEB_PRINT',6,6990000),('WEB_PRINT',12,12990000)
on conflict (plan_code,months) do nothing;
