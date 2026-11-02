# Cuncun local phone signup preview

This page is an isolated **UI preview**, not a production login replacement. It calls the experimental API at the same origin (no third-party scripts or remote services). Existing Gmail login remains in `index.html` and is untouched.

The API currently returns JSON only and does **not** serve HTML. To preview this UI, a future local-only static-serving route must be added to the API (or serve it from the same origin using a local reverse proxy). Do **not** open the HTML directly as a file or host it on a public website: the session cookie and API are local-only. Do not enter real credentials. The phone account is unverified and has no Supabase Auth privileges.
