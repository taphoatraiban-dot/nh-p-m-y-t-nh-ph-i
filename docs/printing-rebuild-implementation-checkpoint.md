# Printing rebuild — implementation checkpoint 2026-10-28

## Verified
- Backup branch: backup/printing-rebuild-before-cleanup-20261028 (created before any edits).
- Current print selector supports share and queue only, but the original index.html still contains legacy Bluetooth/direct controls and handlers.
- The printer settings handler dispatches printerPrintNow through printPhoiBluetooth.click(); therefore deleting old handlers without tracing them would break printing.
- Mac LAN printer endpoint 192.168.1.159:9100 is a user-reported previously working endpoint, not freshly tested.
- No live Supabase queue/worker validation has yet been performed.

## Required implementation sequence
1. Inventory every print handler, duplicated button, queue insert, receipt formatter and worker entrypoint.
2. Implement one print dispatcher and one visible IN NGAY action; preserve working share fallback until queue is proven.
3. Verify Supabase print_queue schema, RLS, tenant ownership, job claiming and idempotency before changing SQL.
4. Implement explicit queued/claimed/printing/printed/failed state transitions. Browser share success only means shared, not printed.
5. Ensure ESC/POS output streams all 50 lines and sends a single paper-cut command after final line; do not automatically retry uncertain TCP writes.
6. Test on feature branch before merging to main. Preserve customer accounts, Telegram, pricing and calculations.

Do not remove old print handlers or change production before inventory and integration tests.
