# Recover existing Supabase Local without modifying production

The Git checkout folder can have a different Supabase project ID from the existing local Docker stack. Running `supabase status` in that checkout then checks the wrong container.

## Safe read-only discovery

```bash
printf '\\nExisting local Supabase containers:\\n'
docker ps -a --filter 'name=supabase_' --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'
printf '\\nLocal checkout project config:\\n'
if [ -f supabase/config.toml ]; then grep -E '^project_id[[:space:]]*=' supabase/config.toml; else echo 'No config.toml here'; fi
printf '\\nAvailable Supabase commands:\\n'
supabase status --help | head -50
```

Do not run `supabase stop --no-backup`, `supabase db reset`, `docker rm`, `docker volume rm`, or link this working copy to production. Prefer checking the existing local checkout and matching project ID before starting anything. The local smoke test also requires a local-only publishable/anon key; never paste the key into chat.


## Test the actual SMS-free phone/password approach

The project intentionally has Supabase native phone Auth disabled because no SMS provider is configured. Do **not** use the native `/auth/v1/signup` phone endpoint as the acceptance test. The isolated experiment maps a normalized Vietnamese phone number to a deterministic synthetic email identity and uses Supabase Email/Password Auth; this does not prove phone-number ownership.

After confirming the existing Local stack is running and its URL/key are local-only, run from the repository root:

```bash
cd experiments/phone-password
npm install --no-package-lock --ignore-scripts --no-audit --no-fund
SUPABASE_LOCAL_URL=http://127.0.0.1:54321 \\
SUPABASE_LOCAL_ANON_KEY='YOUR_LOCAL_PUBLISHABLE_OR_ANON_KEY' \\
PHONE_ALIAS_SECRET='YOUR_RANDOM_LOCAL_SECRET_AT_LEAST_32_BYTES' \\
TEST_PHONE='0912345678' \\
node phone-alias-local-smoke.mjs
```

Use a disposable test phone and password. This creates a local Auth account; rerunning with the same phone will report that it already exists. Never use the production URL/key or paste secrets into chat. Local Auth must have Email enabled and email auto-confirm enabled for this no-SMS test. The smoke test only proves local account creation and password login; it does not grant a product license, verify phone ownership, or create an app session.
