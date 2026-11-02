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
