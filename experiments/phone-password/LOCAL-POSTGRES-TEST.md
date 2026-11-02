# LOCAL PostgreSQL integration test (not production)

This experiment is isolated from Supabase Auth and cannot log into the Cuncun website.

Prerequisites: Node.js, a local PostgreSQL server, and the `pg` package installed **outside** the production website bundle. For example, in a temporary test directory run `npm install --no-save pg`. Node resolves `pg` relative to the test file, so place this experiment and its dependency in the same temporary project.

1. Start an **isolated local** PostgreSQL database.
2. Apply `phone-password-schema.sql` **only to that local database** using `psql`. Review the connection target first.
3. Supply a local-only URL with the required private-schema database privileges:

```sh
PHONE_AUTH_TEST_DATABASE_URL='postgresql://postgres:LOCAL_PASSWORD@127.0.0.1:54322/postgres' node --test postgres-phone-integration.test.mjs
```

The test refuses non-loopback database hosts, creates one randomized unverified test account, logs in, revokes the session, then deletes only that test account. It does not run if the URL is absent. Do not use the production Supabase database or production credentials. This is not an HTTP API, and the injected allow-all limiter is TEST ONLY.
