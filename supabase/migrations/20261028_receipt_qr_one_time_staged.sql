-- Staged only. Review and back up production before applying.
-- Private verification records: never expose raw tokens to browser clients.
create table if not exists public.receipt_verifications (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id),
  receipt_code text not null,
  receipt_snapshot jsonb not null,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active','redeemed','void')),
  issued_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id),
  voided_at timestamptz,
  constraint redeemed_state_consistent check ((status = 'redeemed') = (redeemed_at is not null)),
  unique (owner_user_id, receipt_code)
);
create index if not exists receipt_verifications_owner_idx
  on public.receipt_verifications(owner_user_id, issued_at desc);
alter table public.receipt_verifications enable row level security;
revoke all on public.receipt_verifications from public, anon, authenticated;
-- No client policies. Server functions must verify identity/ownership.
-- Atomic one-time redemption should use:
-- update ... set status='redeemed',redeemed_at=now(),redeemed_by=$actor
-- where token_hash=$hash and status='active' returning id;
