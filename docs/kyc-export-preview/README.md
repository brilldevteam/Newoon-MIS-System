# KYC Export Review

Open `index.html` to inspect pages rendered from the actual backend DOCX export, not a separate HTML approximation. All sample client data is synthetic.

Regenerate on Windows with Microsoft Word installed:

```powershell
npm.cmd run build -w backend
node backend/scripts/preview-kyc-docx.cjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File backend/scripts/render-kyc-word.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File backend/scripts/render-kyc-pages.ps1
```

The Word renderer opens only the sample document, invisibly, and closes its own instance. Inspect every generated page after changes. Structural checks cannot replace this review. These scripts do not require database credentials and are not production server dependencies.

## Verification Limits

The sample opens in Microsoft Word and includes the ownership diagram. The local page-image rendering paths have shown inconsistent letterhead visibility and font rasterization. Check the DOCX in Word before approving production layout; the gallery is a QA aid, not certification. Long multi-owner structures and signature/stamp combinations still require additional fixtures.
