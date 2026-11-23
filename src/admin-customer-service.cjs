'use strict';

const { normalizeRows, filterRows } = require('./admin-customer-overview.cjs');

class AccessDeniedError extends Error {
  constructor() { super('Chỉ chủ phần mềm được xem dữ liệu quản trị.'); this.name = 'AccessDeniedError'; }
}

// Dependency-injected read-only Supabase adapter. The caller supplies an
// authenticated client; the database RPC independently checks admin_users.
// This module never makes writes and never falls back to a broad/secret RPC.
function createCustomerService(client, { now = () => new Date() } = {}) {
  if (!client || typeof client.rpc !== 'function') throw new TypeError('Supabase RPC client is required');

  let generation = 0;
  async function list({ search = '', status = 'all' } = {}) {
    const requestId = ++generation;
    const license = await client.rpc('check_email_license');
    if (requestId !== generation) return { stale: true, rows: [] };
    if (license.error) throw new Error('Không kiểm tra được quyền Admin.');
    if (license.data?.success !== true || license.data?.is_admin !== true) throw new AccessDeniedError();

    const result = await client.rpc('admin_customer_overview');
    if (result.error) throw new Error('Không tải được danh sách khách hàng.');
    if (requestId !== generation) return { stale: true, rows: [] };

    return { stale: false, rows: filterRows(normalizeRows(result.data, now()), { search, status }) };
  }
  function invalidate() { generation += 1; }
  return Object.freeze({ list, invalidate });
}

module.exports = { AccessDeniedError, createCustomerService };
