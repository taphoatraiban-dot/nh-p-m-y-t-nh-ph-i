-- LOCAL TEST ONLY. Never apply this migration to production.
-- Reproduce disposable local Supabase prerequisite schema before phone migration.
-- No production user records or credentials are copied.
-- Local-only prerequisite schema, based on production column metadata (2026-11-02).
-- Do not apply to production. Does not copy any user data.
begin;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'user',
 created_at timestamptz not null default now(),
 display_name text
);
create table if not exists public.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table if not exists public.email_licenses (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 activated_at timestamptz not null default now(),
 expires_at timestamptz not null,
 active boolean not null default true,
 note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.licenses (
 user_id uuid primary key references auth.users(id) on delete cascade,
 phone text,
 activated_at timestamptz not null default now(),
 expires_at timestamptz not null,
 active boolean not null default true,
 note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.email_licenses enable row level security;
alter table public.licenses enable row level security;
-- No anon/authenticated policies: service_role only until reviewed.
commit;
