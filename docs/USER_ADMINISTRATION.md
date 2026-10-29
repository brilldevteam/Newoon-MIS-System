# User Accounts and Login

Updated 29 October 2026. This describes the new local implementation; it is not evidence that the client server has deployed it. Deploy frontend and backend together. No schema migration or seed is required for these changes.

## Sign in

Use the email and application login password created for your account, not the PostgreSQL password or JWT secret. Login accepts case-insensitive email with surrounding whitespace removed. Passwords are not trimmed or silently changed. Invalid email/password responses remain generic so account existence is not exposed. The removal of demo buttons does not alter any real accounts or reset passwords.

The login page starts empty and no longer publishes test accounts or default passwords. Existing development seed data was not deleted: never run the demo seed as a production setup/deployment step. If legacy demo accounts exist on another environment, an authorized administrator can suspend them after verifying they are not real working accounts. This task does not automatically identify/delete accounts by email.

## Add a team member

1. Sign in as Company Admin and open **Users** in the application navigation (or `/users`).
2. Select **Add user**. Enter first name, last name and the user's own email.
3. Select one or more workflow roles. Normally give a person only the role needed for their work; combining reviewer roles affects separation of duties.
4. Set and confirm a unique password with at least 16 characters and at most 72 UTF-8 bytes. The byte limit prevents bcrypt truncation, especially with non-ASCII passwords.
5. Select **Create user**, then share the credentials through the client's approved private channel. No automatic invitation, password email, self-registration or email verification is implemented.

Company Admin creates users only in its own tenant. Super Admin must choose an active company. Email addresses are unique across the application. Duplicate/invalid submissions display an error without leaving a user without role assignments. Passwords are bcrypt-hashed and never returned by the user API or included in audit metadata.

## Roles and permissions

| Role | Usual responsibility |
|---|---|
| Company Admin | Manage its company users and administrative workflow overrides |
| Operations Team | Intake, client enquiries and operational actions |
| AML Team / AML Supervisor | KYC preparation, Screening, CRRF and Supervisor stage |
| DMLRO | DMLRO review and authorized final decisions |
| MLRO | MLRO review, risk decisions and authorized final decisions |
| SEF | Escalated management review |
| Accounting / HR | Existing limited access; not KYC approval authority |
| Super Admin | Platform-level administration, assignable only by Super Admin |

The role catalog is predefined because workflow guards use these exact role names. The Users page assigns/removes existing roles; it does not create arbitrary custom role names. Existing **Access Control** is a separate Super-Admin-only screen for changing role-level module VIEW/EDIT/NONE permissions. Company Admin user management does not grant access to change those global permissions. The new Users service additionally requires actual administrator roles, even if a generic administration-area grant would otherwise allow the controller.

## Edit and suspend

Search by name/email or filter by role/status. Use the pencil action to edit names, email, roles and account status. Choose **Suspended** and save to block subsequent authenticated requests and login; choose **Active** to restore access. There is no hard-delete user action, preserving review/audit references.

You cannot change your own roles or suspend yourself. At least one active Company Admin must remain per company. Company Admin cannot assign Super Admin or modify/reset a Super Admin account. Platform-admin removal is protected. Cross-tenant targets are rejected. Super Admin can manage company users across companies, but a user is not transferred to a different tenant through an edit request.

These protections are implemented server-side, not just by hidden buttons. Configured administration VIEW-only users can browse but do not get write actions. Existing role and workflow permission systems remain in place elsewhere.

## Reset a password in the application

Select the key action beside an authorized account, enter and confirm a new password, then choose **Update password**. Share it privately; it is not emailed. Resetting changes only that user's password and writes an audit event. Password fields are cleared when the dialog closes, and reset values are not stored in browser storage.

Current limitation: password reset does not revoke already issued JWT sessions. Suspension is checked on subsequent authenticated requests, and role changes are read from the database. For a suspected account compromise, coordinate session/token handling with the operator; do not assume password reset alone logs out every active session. No token-version schema migration was introduced in this task.

## Recover a locked-out administrator from SSH

Use only on the approved target server as the `newoon` application user, after deploying the new recovery script. Do not pass a password as a command-line argument or paste `.env` contents. Stay in an interactive terminal:

```bash
cd /home/newoon/apps/newoon-mis
node --env-file=backend/.env backend/scripts/reset-admin-password.cjs
```

Enter the administrator email, a new password and its confirmation, then type `RESET`. Password input is hidden. The script refuses unknown/non-administrator accounts, never creates demo data and does not change roles, tenant or status. It transactionally updates the password hash and records an operator-recovery audit event. It requires the local backend environment and Node 22 runtime already used for this installation. No PM2 restart is required for a password-only change.

If an administrator is suspended, password recovery does not reactivate it. Investigate the suspension with the authorized operator instead of bypassing it.

## Verification and deployment

After a successful root workspace build:

```bash
node backend/scripts/check-user-administration.cjs
node frontend/scripts/check-user-administration-ui.cjs
```

The backend script uses mocks, DTO checks and bcrypt comparisons; it is not a PostgreSQL transaction/concurrency test. The UI script runs Chromium with synthetic API fixtures at desktop, mobile and 320px widths, writes screenshots to the operating system temporary directory, and never logs into production. The frontend browser tooling uses the repo's existing Puppeteer because Playwright CLI is not installed locally.

On staging verify real Company Admin and Super Admin sessions; both access-matrix modes; cross-tenant tampering; last-admin races; duplicate emails; user creation/edit/suspension/reset; old-token behavior; keyboard/focus and password-manager autofill. No database migration is needed. The earlier architecture review is a frozen assessment of its recorded commit and is not automatically a current inventory of these new endpoints.

New APIs: `GET /api/users/options`, `POST /api/users`, `PATCH /api/users/:id`, `POST /api/users/:id/reset-password`. `GET /api/users` remains available with stricter service authorization and safe selected fields. Write bodies use concrete validated DTOs; PATCH replaces the supplied profile/role set and requires firstName, lastName, email, roles and ACTIVE/SUSPENDED status. Tenant cannot be changed by PATCH. Password is only accepted on create/reset. New passwords are 16+ characters/72 UTF-8 bytes maximum. No public registration or forgotten-password HTTP endpoint was added.
