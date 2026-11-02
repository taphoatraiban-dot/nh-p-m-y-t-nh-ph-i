// LOCAL-only admin data adapter. Never expose directly to a phone-session client.
// Caller must authenticate existing administrator independently before invoking writes.
import { planGrantChange } from './admin-grants-core.mjs';
export function createPostgresAdminGrantsStore(pool) {
 if (!pool || typeof pool.query !== 'function') throw new TypeError('Postgres pool required');
 return {
  async listPending({limit=50}={}) {
   if (!Number.isInteger(limit)||limit<1||limit>100) throw new TypeError('INVALID_LIMIT');
   const r=await pool.query(`select a.id,a.phone_e164,a.created_at,
      coalesce(g.status,'pending') as status
      from phone_auth_private.accounts a
      left join phone_auth_private.access_grants g on g.account_id=a.id
      where a.disabled_at is null and (g.status is null or g.status='pending')
      order by a.created_at asc,a.id asc limit $1`,[limit]);
   return r.rows;
  },
  async applyAction({admin,accountId,action,term,now=new Date()}) {
   // Transaction locks grant row and serializes approvals for a given account.
   // A parent account lock also serializes initial inserts when no grant row exists.
   const client=await pool.connect();
   try {
    await client.query('begin');
    const account=await client.query('select id from phone_auth_private.accounts where id=$1 and disabled_at is null for update',[accountId]);
    if (!account.rows.length) throw new Error('ACCOUNT_NOT_FOUND');
    const old=await client.query('select status,expires_at,revoked_at from phone_auth_private.access_grants where account_id=$1 for update',[accountId]);
    const previous=old.rows[0]??null;
    const grant=planGrantChange({admin,accountId,action,term,now,previous});
    const result=await client.query(`insert into phone_auth_private.access_grants
      (account_id,status,expires_at,revoked_at,approved_by,updated_at)
      values ($1,$2,$3,$4,$5,$6)
      on conflict(account_id) do update set status=excluded.status,
      expires_at=excluded.expires_at,revoked_at=excluded.revoked_at,
      approved_by=excluded.approved_by,updated_at=excluded.updated_at
      returning account_id,status,expires_at,revoked_at,updated_at`,
      [grant.account_id,grant.status,grant.expires_at,grant.revoked_at,grant.approved_by,grant.updated_at]);
    await client.query(
      'insert into phone_auth_private.grant_audit (account_id,actor_id,action,term,previous_status,new_status) values ($1,$2,$3,$4,$5,$6)',
      [accountId,admin.id,action,term??null,previous?.status??'pending',result.rows[0].status]
    );
    await client.query('commit');
    return result.rows[0];
   } catch(e) {await client.query('rollback');throw e}
   finally {client.release()}
  }
 };
}
