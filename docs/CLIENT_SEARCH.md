# Compliance Client Search

Scope: the existing Compliance Clients register and its filtered Excel export. No other module's search, form, workflow, schema, permission grant or document rendering is changed.

## Searchable Data

- Company name/code, CR/registration and tax numbers, country, address, telephone/email, legal form, business activities, services, website and other saved company-profile text.
- Active linked people: name, title, nationality, address, telephone/email, represented entity, QID, corporate registration number, linked company, visible role/position and custom position wording.
- All saved passports of visible people, including additional/older passport entries, where the user's role permits passport access. Mixed legacy identity fields follow the same restriction.
- Contact names, phone/email and positions; engagement reference, service and description; permitted KYC references.
- Current legal-register document number, holder, type, location, filename and notes; permitted current document metadata. Binary/PDF/image contents are not full-text indexed.
- DOB/identity/CR/document dates in `YYYY-MM-DD` or `DD/MM/YYYY`/`DD-MM-YYYY`, visible review dates, jurisdiction and permitted risk/CDD values.

Search is case-insensitive partial text. Multiple words must all match somewhere within the same client and its visible related records. Results are clients, not a separate person directory: the same person linked to several clients can return all of those clients. Open a result to view their permitted related records. Existing filters, paging and export scope still apply; summary cards retain the register's existing overall statistics.

Search reads the current saved company/person/contact records on each request, including edited email addresses and replaced identity numbers. It does not rely on the original KYC snapshot or a stale client-side index. Earlier dashboard/login commits did not include this separate search patch; pulling those commits alone cannot deploy it. Deploy both backend and frontend from a commit that includes `backend/src/compliance-clients/client-search.ts`.

## Privacy And Limits

- The original tenant/allocation/register-status predicate remains mandatory outside the search OR. Related records are tenant-scoped too.
- Non-full roles cannot match UBO-only people or hidden UBO roles. Archived people and deleted/replaced legal-document metadata are excluded.
- Allocated staff cannot search passport records, mixed legacy identity strings or hidden KYC/risk/CDD/review values. Operations cannot search hidden AML folders, PEP details or review comments. No role can search storage paths, password hashes or internal tracking fields.
- Company/people fields come from the saved client records, not historical approved KYC snapshots. Older clients whose records have never been initialized need the application's existing first client-detail load/approved migration process; this change deliberately does not write/backfill records during search or scan every historical KYC JSON.
- Existing 120-character input cap remains. This uses relational substring filters rather than a separate search service; measure PostgreSQL latency with realistic tenant volumes before a large SaaS rollout. Normalization of arbitrarily formatted stored identity strings and document-body OCR indexing are not introduced.
- The frontend debounces input as before and ignores obsolete responses, so a slow previous query cannot overwrite newer results.

## Verification

After `npm run build`:

```text
node backend/scripts/check-client-search.cjs
node backend/scripts/check-client-access.cjs
node backend/scripts/check-compliance-clients.cjs
node frontend/scripts/check-client-search-ui.cjs
```

These use synthetic fixtures and mocked persistence/HTTP. TypeScript checks Prisma predicate types. They do not replace a real PostgreSQL staging test with two tenants, allocated accounts, older clients, large datasets and a filtered Excel export. No application database is accessed by these checks.
