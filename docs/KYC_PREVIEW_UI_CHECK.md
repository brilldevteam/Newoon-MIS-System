# KYC Builder Preview Update

Baseline: `28e0003`, document-autofill feature branch.
Working branch: `fix/kyc-builder-preview-ui/2026-11-24`.

## Scope

- Share the existing control-structure renderer between the editor and preliminary/full document previews.
- Restore the diagram in the preliminary preview, using current form ownership rows while editing.
- Add Document/Structure preview modes, fit-width/zoom selection and fullscreen controls.
- Clarify the active section and responsive navigation; keep mobile scrolling at page level.
- Preserve saved data, ownership limits, permissions, review routing and export templates.

## Local Verification

Run from the repository root:

```sh
npm run build
node frontend/scripts/check-kyc-preview-diagram.cjs
```

The browser check uses synthetic company/person data, checks diagram connectors and linked names, mode/zoom controls, browser errors and page overflow at 1440, 768, 390 and 320 pixels. Screenshots are saved to the OS temporary directory.

Before release, also check the complete authenticated builder with a large real-world-shaped synthetic ownership tree, empty ownership, long names and review-only roles. Fullscreen availability depends on browser policy. Local component checks are not server verification or export-layout certification. No database migration is required.
