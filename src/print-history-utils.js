/* Pure helpers for locally saved printed-slip history. No network calls. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TSHPrintHistoryUtils = api;
})(typeof window !== 'undefined' ? window : null, function() {
  'use strict';
  function message(record) {
    const raw = String(record?.raw || record?.phoi || record?.message || '').trim();
    if (raw) return raw;
    const text = String(record?.text || '').replace(/\r\n?/g, '\n');
    const lines = text.split('\n');
    const separators = [];
    lines.forEach((line, index) => {
      if (/^[-=]{8,}\s*$/.test(line.trim())) separators.push(index);
    });
    if (separators.length >= 2) {
      const slip = lines.slice(separators[0] + 1, separators[1]).join('\n').trim();
      if (slip) return slip;
    }
    return lines.filter(line => {
      const v = line.trim();
      return v && !/^(?:\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}|KHACH:|TIEN XAC:|THU:|BU:|MA PHIEU:|\[\[QR:|Phieu chi co gia tri)/i.test(v);
    }).join('\n').trim();
  }
  function combined(records) {
    return (records || []).map(message).filter(Boolean).join('\n\n');
  }
  return { message, combined };
});
