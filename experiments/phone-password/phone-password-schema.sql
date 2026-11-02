-- EXPERIMENT ONLY. Review and test locally before applying.
-- This schema is intentionally private and is NOT connected to Supabase Auth.
-- Do not apply to production without a migration and security review.
create schema if not exists phone_auth_private;
revoke all on schema phone_auth_private from public, anon, authenticated;

create table if not exists phone_auth_private.accounts (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique,
  password_hash text not null,
  phone_verified boolean not null default false,
  created_at timestamptz not null default now(),
  disabled_at timestamptz,
  constraint phone_e164_format check (phone_e164 ~ '^[+]84[35789][0-9]{8}$'),
  constraint password_hash_format check (password_hash like 'scrypt$16384$8$1$%')
);
alter table phone_auth_private.accounts enable row level security;
revoke all on phone_auth_private.accounts from public, anon, authenticated;

create table if not exists phone_auth_private.sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references phone_auth_private.accounts(id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint session_expiry check (expires_at > created_at)
);
create index if not exists phone_sessions_account_idx on phone_auth_private.sessions(account_id);
create index if not exists phone_sessions_expiry_idx on phone_auth_private.sessions(expires_at);
alter table phone_auth_private.sessions enable row level security;
revoke all on phone_auth_private.sessions from public, anon, authenticated;

-- Important: These identities do not map to auth.users.
-- A secure server-side bridge and explicit authorization design are required
-- before these identities can access existing application data.
),
  constraint password_hash_format check (password_hash like 'scrypt$16384$8$1$%')
);
alter table phone_auth_private.accounts enable row level security;
revoke all on phone_auth_private.accounts from public, anon, authenticated;

create table if not exists phone_auth_private.sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references phone_auth_private.accounts(id) on delete cascade,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint session_expiry check (expires_at > created_at)
);
create index if not exists phone_sessions_account_idx on phone_auth_private.sessions(account_id);
create index if not exists phone_sessions_expiry_idx on phone_auth_private.sessions(expires_at);
alter table phone_auth_private.sessions enable row level security;
revoke all on phone_auth_private.sessions from public, anon, authenticated;

-- Important: These identities do not map to auth.users.
-- A secure server-side bridge and explicit authorization design are required
-- before these identities can access existing application data.
