# Phone + password registration: implementation security contract

Status: isolated development branch; NOT approved for production.

## User requirements
- Register and sign in with phone number and password, no SMS or OTP provider fees.
- Keep existing email/Gmail authentication, user identities, permissions, and data unchanged.
- Never alter production Supabase Auth settings merely to enable phone login.

## Mandatory backend boundaries
1. A dedicated server-side auth service verifies passwords; do not store password hashes or service-role credentials in the browser.
2. Normalize phone numbers to E.164; reject invalid or ambiguous numbers. Enforce uniqueness using a database constraint.
3. Store only memory-hard password hashes (Argon2id preferred) with per-password salts; never store or log plaintext passwords.
4. Apply rate limits by account and network, generic error messages, and audit logging without secrets.
5. Phone numbers without SMS verification are **unverified identifiers**. Never use possession of such a number as proof of identity, for account recovery, or to link to an existing email account.
6. Require an independently authenticated recovery method or administrator-assisted recovery with identity checks.
7. Bind authorization to server-issued verified sessions and immutable user IDs; do not trust user_metadata for roles or user-supplied phone numbers for privileges.
8. Preserve existing account mapping; no destructive migration or automatic linking of accounts by phone.
9. Keep signup and login on a staging environment until integration tests, authorization checks, and recovery tests pass.

## Required integration tests before release
- Register a new phone identity, login with correct password, reject incorrect password.
- Reject duplicate normalized numbers; ensure concurrent signup cannot create duplicates.
- Test rate limiting and session expiry/revocation.
- Confirm existing Gmail sign-in and user data remain unaffected.
- Confirm an unverified phone identity cannot claim or reset an existing account.
- Confirm no secret or password hash is exposed to clients.

This file is a security checklist, not an implemented authentication endpoint.
