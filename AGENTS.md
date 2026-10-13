# Repository Instructions

Applies to the entire repository. Read `docs/DEVELOPER_HANDOVER.md` before changing application behavior or deploying.

## Project

- npm workspace monorepo: React/Vite frontend and NestJS/Prisma/PostgreSQL backend.
- Run workspace commands from the repository root. Use `npm.cmd` on PowerShell if script shims are blocked.
- Source of truth: current source, Prisma schema, migrations, and package scripts. Historical change reports are not proof of deployed behavior.
- Backend build automatically generates Prisma Client through `prebuild`. Do not remove that hook.

## Change Discipline

- Check `git status` and the current branch before editing. Preserve unrelated user changes.
- Keep changes scoped; follow existing controllers, services, DTOs, frontend service wrappers, and route guards.
- Never weaken TypeScript checks or add broad `any` casts to hide missing Prisma generation.
- Preserve tenant scoping, role/access checks, confidential-review visibility, audit events, and notification behavior.
- Frontend permissions are presentation only; backend authorization must remain enforced.
- Do not modify existing applied migrations. Add new migrations for schema changes and review their SQL.

## Secrets and Production Safety

- Never read out, paste, commit, or expose `.env`, tokens, private KYC records, or uploaded documents.
- Use `.env.example` to document variable names, with placeholders only. Vite variables are public browser configuration.
- Never run `prisma migrate reset`, `db push`, or the seed script on a shared database without explicit authorization.
- The seed script resets passwords for several existing seeded users. It is not a deployment step.
- Back up the database and uploads before migrations. Use `prisma migrate deploy` for approved production migrations, not `migrate dev`.
- Do not restart PM2 after a failed build. Do not delete uploads or operate on other PM2 applications.
- Never run `npm audit fix --force` without reviewing and authorizing its breaking changes.

## Verification

- Run `npm run build` after application changes and wait for its successful exit.
- For document export changes, run `node backend/scripts/preview-kyc-docx.cjs` after building, then render the DOCX in Word and inspect every page.
- XML/package assertions and the live HTML form preview do not prove Word layout quality.
- Test large ownership trees, long names, multiple managers, missing values, signatures/stamps, and multi-page documents where relevant.
- No workspace test/lint scripts are currently defined. Document manual tests and unverified scenarios explicitly.
- Report local verification separately from server verification. Do not claim a push or deployment without evidence.

## Delivery

- Update handover documentation when changing setup, environment variables, export dependencies, or deployment behavior.
- Stage explicit task-related paths. Commit/push only when requested, using the agreed branch.
- Include changed behavior, verification results, remaining limitations, and any required server steps in the final handover.
