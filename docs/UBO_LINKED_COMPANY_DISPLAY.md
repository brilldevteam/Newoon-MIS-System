# Linked Company in Beneficial-Owner Tables

Beneficial-owner tables now have a separate Company column showing the linked corporate shareholder. The person's name remains in its own column without a parenthetical company suffix. This applies to the full KYC preview, PDF and DOCX, and preliminary preview/PDF. The full KYC table allocates fixed widths to all seven columns so company names wrap without squeezing other fields. No percentages are changed.

If a copied UBO row omits the parent link, its sourceShareholderId (or matching row ID) is used to resolve the linked source row. No identity/name guessing is performed. Direct owners show Direct ownership in the Company column; unresolved saved parent IDs show Linked shareholder unavailable rather than inventing a company. Editing or repairing missing historical links remains an explicit user action.

The change only formats display text: stored records, deduplication, ownership totals, diagrams, approval logic and permissions remain unchanged. No migration/dependency changes. Existing generated files are not rewritten; generate a new export. Run `node backend/scripts/check-ubo-company-display.cjs` after building; synthetic PDF/HTML and DOCX package checks do not replace Word layout review or live database verification.
