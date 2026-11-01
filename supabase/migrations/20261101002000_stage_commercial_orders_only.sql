-- ADDITIVE ONLY. Do not apply until backup/restore and RLS review.
-- Payment records do not activate, renew or revoke existing licenses.
create table if not exists public.ott_commercial_orders (
 id uuid primary key default gen_random_uuid(),
 customer_user_id uuid not null references auth.users(id) on delete restrict,
 plan_code text not null check(plan_code in ('WEB','WEB_PRINT')),
 duration_months integer not null check(duration_months in (1,3,6,12)),
 amount_vnd bigint not null check(amount_vnd>0),
 status text not null default 'pending' check(status in ('pending','confirmed','cancelled')),
 payment_reference text,
 created_by uuid not null references auth.users(id) on delete restrict,
 confirmed_by uuid references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 confirmed_at timestamptz,
 notes text,
 check ((status='confirmed' and confirmed_by is not null and confirmed_at is not null)
     or (status<>'confirmed' and confirmed_by is null and confirmed_at is null))
);
create index if not exists ott_commercial_orders_customer_created
 on public.ott_commercial_orders(customer_user_id,created_at desc);
create unique index if not exists ott_commercial_orders_payment_reference_unique
 on public.ott_commercial_orders(payment_reference)
 where payment_reference is not null and payment_reference <> '';
alter table public.ott_commercial_orders enable row level security;
revoke all on public.ott_commercial_orders from anon,authenticated;
-- No direct customer access, no automatic payment confirmation.
-- Admin RPC and ledger audit to be reviewed separately.
