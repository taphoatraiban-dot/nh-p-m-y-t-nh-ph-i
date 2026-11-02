# LOCAL PostgreSQL admin approval integration test

This tests the private database adapter, not production admin authentication or Cuncun permissions. Never run against production. The test creates and deletes one disposable account.

1. Start the LOCAL PostgreSQL container used by the phone experiment.
2. Apply `phone-access-grants-local.sql` to the LOCAL database once, using psql. Do not apply to the production project.
3. In the LOCAL test folder, export `PHONE_AUTH_TEST_DATABASE_URL` pointing to loopback PostgreSQL and run `node --test postgres-admin-grants-integration.test.mjs`.
4. Expect 1 pass, 0 fail; inspect any errors before proceeding.

No administrator HTTP endpoint is exposed. The existing authenticated admin session must be integrated securely before enabling real approval buttons.
