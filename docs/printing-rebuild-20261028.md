# Cuncun printing rebuild — 2026-10-28

Status: isolated development branch. Do not deploy or remove existing printing until replacement passes tests.

## Requirements
- One primary IN NGAY action, 80mm ESC/POS, fast printing, proper cut after full receipt.
- iPhone Safari cannot send raw TCP socket to 192.168.1.159:9100 or magically discover a non-AirPrint printer.
- Preferred reliable route: authenticated Supabase print queue -> always-on Mac worker -> raw TCP 9100. Mac required for this route.
- Separate optional route for iPhone without Mac requires a verified native iOS ESC/POS bridge or compatible hardware; do not present AirPrint as working.
- Keep share/AirPrint only as explicitly labelled fallback until verified; no silent auto-selection.
- Enforce authenticated user ownership and tenant isolation, queue job IDs, idempotency, claimed/printing/printed/failed status, retry policy, worker heartbeat, no duplicate printing.
- Never mark printed merely because browser dialog opened.
- Preserve user accounts, receipts, pricing, Telegram, Supabase records, and original printer paths during migration.

## Migration gates
1. Inventory all existing print controls and handlers in index.html.
2. Add a single facade/dispatcher, route legacy controls through it without deleting old functions.
3. Implement worker protocol and database access controls; validate against current schema before migration.
4. Test 1, 20, 50 lines, unicode, paper cut, disconnect/reconnect, retries and duplicates.
5. Deploy behind feature flag, validate production receipts, then remove obsolete controls in a later commit.

## Observed baseline
- index.html has printerTransportMode and printPhoiToMac with queue, macqueue, share, airprint, native, legacy modes.
- Existing hardware XP-Q809K responds via 192.168.1.159:9100 from Mac.
- macOS shares IPP queues, but iPhone AirPrint discovery not verified and _universal browse returned no service.
