# Change Your Password

All authenticated roles can use Change Password in the sidebar (`/account/password`). The current password and matching new password/confirmation are required. New passwords require at least 16 characters and at most 72 UTF-8 bytes.

`POST /api/auth/change-password` uses only the authenticated account ID, not a client-supplied target. It verifies bcrypt, prevents stale hash overwrites, and writes the update and credential-free audit in one transaction. Five failed current-password attempts block this action for 15 minutes per account, per backend process; the limit resets on process restart and is not distributed.

This standalone change requires no migration or new dependencies. The browser signs out after success. Existing JWTs on other devices are NOT revoked by this release; session-version/OTP work is deliberately excluded. No roles, tenant assignments or workflow records are changed.

Deployment: build both workspaces, run `node backend/scripts/check-self-password.cjs`, then restart only the application process after successful verification. Do not seed or reset the database.
