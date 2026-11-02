# Admin API integration gate

The admin handler is an isolated server-side module. It is NOT mounted into the public or local phone HTTP server.

Before mounting:
- Implement verifyAdmin using the existing Cuncun administrator session, validated server-side against authoritative administrator roles. Never trust client-submitted role, id or phone_session.
- Implement verifyCsrf tied to the verified administrator session, with same-origin checks and strict request limits.
- Connect the private PostgreSQL admin store using a restricted server-side database credential; do not expose it in HTML.
- Add action audit logs, throttling, tests with real admin sessions, and production authorization review.
- Only then wire the buttons and display live accounts. The HTML preview intentionally has disabled buttons.

This prevents an unverified phone account from approving itself. Nothing in this branch modifies Gmail sign-in, production RLS or cuncun.icu.
