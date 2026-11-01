# Personal Profile

The header name/avatar opens My Profile, Change Password and Log Out for every authenticated role, including on mobile. Password change is no longer a sidebar item. The existing password route remains available.

GET/PATCH `/api/auth/profile` always uses the JWT account ID. Users can edit first/last name, bio (500 characters) and avatar only. Email, role and tenant are not editable. Writes and credential-free audits are transactional. Bio is rendered as plain text, not HTML.

Pictures are cropped to 256px PNG in the browser (2MB input maximum), decoded and normalized again server-side with the existing canvas library. SVG and external image URLs are rejected; server input is capped at 180,000 characters and 1024px dimensions. The PNG data URL is stored in UserProfile, included only in the self-profile response, not general user lists. Database backups include the avatar; no new uploads directory or dependency is needed.

Apply the additive `20261101120000_user_profiles` migration with `prisma migrate deploy` after backing up the database. Do not deploy unrelated pending migrations without review. Existing accounts need no seed/backfill. Build and synthetic checks do not certify server deployment.
