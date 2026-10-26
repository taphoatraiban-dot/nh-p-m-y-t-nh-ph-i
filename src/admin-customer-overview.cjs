'use strict';

// Read-only presentation adapter. No Supabase client initialization or writes.
const ALLOWED_STATES = new Set(['active', 'soon', 'expired', 'paused', 'pending', 'unlicensed']);

function deriveState(row, now = new Date()) {
  if (row.account_kind === 'pending') return 'pending';
  if (row.license_active === false) return 'paused';
  if (!row.expires_at) return 'unlicensed';
  const expiry = Date.parse(row.expires_at);
  if (!Number.isFinite(expiry)) return 'unlicensed';
  if (expiry <= now.getTime()) return 'expired';
  if (expiry - now.getTime() <= 3 * 86400000) return 'soon';
  return 'active';
}

function normalizeRows(rawRows, now = new Date()) {
  if (!Array.isArray(rawRows)) throw new TypeError('Expected a rows array');
  return rawRows.map(row => {
    if (!row || !['registered', 'pending'].includes(row.account_kind)) {
      throw new TypeError('Unexpected account kind');
    }
    const state = deriveState(row, now);
    if (!ALLOWED_STATES.has(state)) throw new TypeError('Unexpected state');
    if (!row.email || typeof row.email !== 'string') {
      throw new TypeError('Missing account email');
    }
    const revision = row.account_kind === 'pending' ? null : (row.revision ?? 0);
    if (revision !== null && (!Number.isSafeInteger(Number(revision)) || Number(revision) < 0)) {
      throw new TypeError('Invalid customer revision');
    }
    return Object.freeze({
      kind: row.account_kind,
      id: row.user_id ?? null,
      email: row.email,
      status: state,
      expiresAt: row.expires_at ?? null,
      deviceCount: Math.max(0, Number(row.device_count) || 0),
      lastSeen: row.last_seen ?? null,
      revision: revision === null ? null : Number(revision)
    });
  });
}

function filterRows(rows, { search = '', status = 'all' } = {}) {
  const term = String(search).trim().toLocaleLowerCase('vi-VN');
  return rows.filter(row => (status === 'all' || row.status === status) &&
    (!term || `${row.email} ${row.id || ''}`.toLocaleLowerCase('vi-VN').includes(term)));
}

module.exports = { deriveState, normalizeRows, filterRows };
