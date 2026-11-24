# Workspace Login Landing

The common LoginPage completion handler previously hard-coded `/dashboard`; changing the root/home redirect did not affect successful password or email-code login. Both now call the shared `defaultRouteForUser(session.user)` rule and land on `/workspace` for every authenticated role.

The authenticated legacy `/dashboard` route now redirects with history replacement to `/workspace`. Module dashboards remain at `/enquiries/dashboard`, `/kyc-workflow/dashboard` and `/compliance/dashboard`. No authentication API, session policy, role grant, form, preview or export behavior is changed.

Verify after building with `node frontend/scripts/check-workspace-login.cjs`. Synthetic browser tests exercise the registered router, password-only and email-code sign-in for all supported roles, protected legacy/root routes and module navigation. No real account or database is used. Chrome is required; set CHROMIUM_PATH if not using the script's default Windows executable.

After deployment, sign out and sign in again, then test an old `/dashboard` bookmark. If assets are stale, reload the site; do not clear application data or alter stored passwords to resolve a navigation issue.
