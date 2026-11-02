-- LOCAL EXPERIMENT ONLY. NOT a production migration.
-- Approval is server-controlled; never expose this table to anon/authenticated.
create table if not exists phone_auth_private.access_grants (
 account_id uuid primary key references phone_auth_private.accounts(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','approved','denied')),
 expires_at timestamptz,
 revoked_at timestamptz,
 approved_by text,
 updated_at timestamptz not null default now(),
 constraint approval_has_expiry check (status <> 'approved' or expires_at is not null)
);
alter table phone_auth_private.access_grants enable row level security;
revoke all on phone_auth_private.access_grants from public, anon, authenticated;
-- IMPORTANT: A phone session does not provide a Supabase Auth identity.
-- Never grant Cuncun production data access directly from this table.
