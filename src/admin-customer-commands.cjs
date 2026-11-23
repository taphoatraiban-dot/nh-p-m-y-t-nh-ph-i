'use strict';

// Contract for a FUTURE server-side RPC; never invoked by production code.
// A server must independently authorize the signed-in user, enforce target
// revision/idempotency and atomically append its own audit entry.
const ACTIONS = Object.freeze(['extend', 'pause', 'resume', 'reset_device']);

class CommandRejectedError extends Error {
  constructor(message) { super(message); this.name = 'CommandRejectedError'; }
}

function prepareCommand({ action, userId, email, days, reason, revision, confirmation } = {}) {
  if (!ACTIONS.includes(action)) throw new CommandRejectedError('Thao tác không được hỗ trợ.');
  if (typeof userId !== 'string' || !userId.trim()) throw new CommandRejectedError('Thiếu mã khách hàng.');
  if (typeof email !== 'string' || !email.includes('@')) throw new CommandRejectedError('Thiếu email khách hàng.');
  if (confirmation !== email) throw new CommandRejectedError('Phải nhập đúng email để xác nhận.');
  if (!Number.isSafeInteger(revision) || revision < 0) throw new CommandRejectedError('Thiếu phiên bản dữ liệu để chống ghi đè.');
  if (typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 500) {
    throw new CommandRejectedError('Lý do cần từ 10 đến 500 ký tự.');
  }
  if (action === 'extend' && (!Number.isSafeInteger(days) || days < 1 || days > 365)) {
    throw new CommandRejectedError('Chỉ cho phép gia hạn từ 1 đến 365 ngày.');
  }
  return Object.freeze({
    action, userId, email, revision, reason: reason.trim(),
    days: action === 'extend' ? days : null
  });
}

function createCommandService(client, { generateId } = {}) {
  if (!client || typeof client.rpc !== 'function') throw new TypeError('RPC client required');
  if (typeof generateId !== 'function') throw new TypeError('Unique request ID generator required');
  let generation = 0;
  let inFlight = false;
  function invalidate() { generation += 1; }
  async function execute(input) {
    const command = prepareCommand(input);
    if (inFlight) throw new CommandRejectedError('Đang xử lý thao tác khác.');
    const requestId = generateId();
    if (typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(requestId)) {
      throw new CommandRejectedError('Mã yêu cầu không hợp lệ.');
    }
    const epoch = generation;
    inFlight = true;
    try {
      const license = await client.rpc('check_email_license');
      if (epoch !== generation) return { stale: true };
      if (license.error || license.data?.success !== true || license.data?.is_admin !== true) {
        throw new CommandRejectedError('Không có quyền quản trị.');
      }
      const result = await client.rpc('admin_customer_command', {
        p_request_id: requestId,
        p_action: command.action,
        p_user_id: command.userId,
        p_expected_revision: command.revision,
        p_days: command.days,
        p_reason: command.reason
      });
      if (epoch !== generation) return { stale: true };
      if (result.error || result.data?.success !== true) {
        throw new CommandRejectedError('Máy chủ không xác nhận thao tác. Cần tải lại dữ liệu trước khi thử tiếp.');
      }
      return Object.freeze({ stale: false, requestId, result: 'confirmed' });
    } finally {
      inFlight = false;
    }
  }
  return Object.freeze({ execute, invalidate });
}

module.exports = { ACTIONS, CommandRejectedError, prepareCommand, createCommandService };
