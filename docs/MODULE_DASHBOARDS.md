# Module Dashboards

Each workspace tile opens a dedicated dashboard:

- Enquiry: `/enquiries/dashboard`
- KYC: `/kyc-workflow/dashboard`
- Compliance Clients: `/compliance/dashboard`

The sidebar Dashboard link follows the active module. Existing register/detail/notification routes and workflow guards are retained. The workspace selector remains sidebar-free, with its top-bar return shortcut. Successful password and OTP login always land there; the legacy `/dashboard` URL now redirects to `/workspace` (see `WORKSPACE_LOGIN.md`).

## Data And Presentation

- Summary metrics, portfolio rings, status bars and register snapshots use existing permitted API responses. No fabricated growth rates or activity history are introduced.
- Enquiry/KYC count their scoped register responses. Monthly charts use actual createdAt timestamps in UTC buckets with 3/6/12-month controls. Missing timestamps show an empty state; no historical curve is inferred.
- Compliance uses the server's full-register statistics, never totals calculated from its six-row preview. Attention categories can overlap and are therefore bars, not parts of the portfolio ring.
- KYC users with access only to CRRF/Screening/Review Tasks get their permitted tools without fetching unauthorized case data. Allocated compliance users see permitted status statistics, without hidden AML attention charts.
- Loading/failure states never substitute fake zero counts. Summary percentages are shares of the current total, not comparisons with previous periods.
- This is a frontend-only release: no dependency, schema, migration, environment, API authorization, workflow or KYC export/preview changes. The separate client-search work is excluded.

## Verification

Run from the repository root:

```text
npm run build
node frontend/scripts/check-workspace-modules.cjs
node frontend/scripts/check-intake-preview-preservation.cjs
```

Browser checks need Chrome; set CHROMIUM_PATH when its executable is not at the script's default Windows location. They use synthetic API fixtures, not the application database. Checks cover module-only data sources, authoritative totals, chart arithmetic, month controls, missing/empty/error states, restricted accounts and 1440/768/390/320px layouts. Desktop/mobile screenshots are written to the operating-system temporary directory.

Before deployment, verify real tenant data and permissions on staging. Very large enquiry/KYC registers may need separately scoped aggregate endpoints; this UI does not claim new server-side analytics or full SaaS readiness.
