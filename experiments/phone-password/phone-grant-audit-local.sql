-- LOCAL ONLY. Apply before using the audited admin store.
create table if not exists phone_auth_private.grant_audit (
 id bigint generated always as identity primary key,
 account_id uuid not null references phone_auth_private.accounts(id) on delete cascade,
 actor_id text not null,
 action text not null check (action in ('approve','deny','revoke')),
 term text check (term is null or term in ('1m','3m','12m','permanent')),
 previous_status text not null,
 new_status text not null,
 occurred_at timestamptz not null default now()
);
create index if not exists grant_audit_account_idx on phone_auth_private.grant_audit(account_id,occurred_at desc);
alter table phone_auth_private.grant_audit enable row level security;
revoke all on phone_auth_private.grant_audit from public,anon,authenticated;
