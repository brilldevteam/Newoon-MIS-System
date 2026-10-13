# KYC Revision Preview

The PNGs in this folder show the real comparison component with synthetic API fixtures at desktop and mobile sizes. They are not screenshots of live client records.

Regenerate after a frontend build:

```powershell
node frontend/scripts/check-kyc-revisions-ui.cjs
```

The script verifies the change count, original/amended values, both document previews, and page-level horizontal overflow. It uses the existing Puppeteer/Chrome runtime and does not read or change the application database.

The actual application route is `/kyc/:id/revisions`, reached through **Form history & compare** on the case. It requires authenticated case access and the new database migration before database-backed use.
