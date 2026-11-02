// Experimental PostgreSQL adapter. Run ONLY server-side with a restricted DB role.
// pg is injected: import pg from 'pg'; const store = createPostgresPhoneStore(new pg.Pool({ connectionString }));
// No database connection is opened when this module is imported.
export function createPostgresPhoneStore(pool) {
  if (!pool || typeof pool.query !== 'function') throw new TypeError('Postgres pool required');
  return {
    async createAccount({ phone_e164, password_hash, phone_verified = false }) {
      const result = await pool.query(
        'insert into phone_auth_private.accounts (phone_e164, password_hash, phone_verified) values ($1, $2, $3) returning id',
        [phone_e164, password_hash, phone_verified]
      );
      return result.rows[0];
    },
    async findAccountByPhone(phone) {
      const result = await pool.query(
        'select id, password_hash, phone_verified, disabled_at from phone_auth_private.accounts where phone_e164 = $1 limit 1',
        [phone]
      );
      return result.rows[0] ?? null;
    },
    async createSession({ account_id, token_hash, expires_at }) {
      const result = await pool.query(
        'insert into phone_auth_private.sessions (account_id, token_hash, expires_at) values ($1, $2, $3) returning id',
        [account_id, token_hash, expires_at]
      );
      return result.rows[0];
    },
    async findSessionByTokenHash(tokenHash) {
      const result = await pool.query(
        `select s.account_id, s.expires_at, s.revoked_at
         from phone_auth_private.sessions s
         join phone_auth_private.accounts a on a.id = s.account_id
         where s.token_hash = $1 and a.disabled_at is null
         limit 1`,
        [tokenHash]
      );
      return result.rows[0] ?? null;
    },
    async revokeSessionByTokenHash(tokenHash, at) {
      await pool.query(
        'update phone_auth_private.sessions set revoked_at = $2 where token_hash = $1 and revoked_at is null',
        [tokenHash, at]
      );
    }
  };
}
