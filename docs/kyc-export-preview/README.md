# KYC Export Review

Open `index.html` to compare pages produced by the real backend export code: the DOCX as rendered by Microsoft Word (left) and the PDF from the production Chromium pipeline (right). All client data is synthetic.

Fixtures:

- `standard/`: holding company with a single shareholder and UBO, two officers, low risk and simplified due diligence (fictitious data).
- `complex/`: three-layer structure, long, accented and Arabic names, an orphaned party, six managers, missing values, an unanswered sanctions question and an SEF review.

Regenerate on Windows with Microsoft Word and Chrome installed:

```powershell
npm.cmd run build -w backend
node backend/scripts/preview-kyc-docx.cjs
foreach ($n in 'standard','complex') {
  $d = "docs/kyc-export-preview/$n"
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File backend/scripts/render-kyc-word.ps1 -Directory $d
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File backend/scripts/render-kyc-pages.ps1 -Directory $d -Name kyc-sample-word -Prefix word-page
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File backend/scripts/render-kyc-pages.ps1 -Directory $d -Name kyc-chromium -Prefix pdf-page
}
```

`node backend/scripts/preview-kyc-docx.cjs --no-pdf` skips Chromium. Page images are rasterised at screen resolution, so hairline borders can disappear in them. Pass `-Width 2400` to `render-kyc-pages.ps1` to check fine detail.

## Verification Limits

The gallery is a QA aid, not certification. Open the DOCX in Word before approving layout changes. Very wide ownership structures (more than about 12 leaf parties) are scaled down to fit one page. The diagram then carries a note, and the table below it remains the complete record.
