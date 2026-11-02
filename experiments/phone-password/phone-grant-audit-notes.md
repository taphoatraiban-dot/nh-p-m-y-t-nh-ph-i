# Local entitlement audit

Apply phone-grant-audit-local.sql to the LOCAL PostgreSQL database before testing the updated admin store. Every approval, denial or revocation now inserts an audit row inside the same database transaction as the grant update; audit failure rolls back the grant.

This does not establish administrator identity. The admin API remains unmounted until a trusted existing Cuncun admin verifier and CSRF verifier are implemented. No production changes.
