# Linked Company in Beneficial-Owner Tables

Beneficial-owner names now include `(Through: Corporate Shareholder Name)` when parentRowId links the individual to a shareholder. This is printed in the existing name cell in the full KYC preview, PDF and DOCX, and preliminary preview/PDF. No columns or percentages are changed.

If a copied UBO row omits the parent link, its sourceShareholderId (or matching row ID) is used to resolve the linked source row. No identity/name guessing is performed. Direct owners keep their names unchanged; unresolved saved parent IDs show Linked shareholder unavailable rather than inventing a company. Editing or repairing missing historical links remains an explicit user action.

The change only formats display text: stored records, deduplication, ownership totals, diagrams, approval logic and permissions remain unchanged. No migration/dependency changes. Existing generated files are not rewritten; generate a new export. Run `node backend/scripts/check-ubo-company-display.cjs` after building; synthetic PDF/HTML and DOCX package checks do not replace Word layout review or live database verification.
