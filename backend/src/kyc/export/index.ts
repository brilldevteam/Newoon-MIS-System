import { renderKycDocx } from './kyc-docx-renderer';
import { buildKycDocumentModel, KycExportPayload } from './kyc-document-model';
import { loadLetterhead } from './kyc-export-assets';
import { PDF_MARGIN_MM, pdfHeaderFooter, renderKycHtml } from './kyc-html-renderer';
import { KycPdfRenderer } from './kyc-pdf-renderer';

export { KycPdfRenderer } from './kyc-pdf-renderer';
export type { KycExportPayload } from './kyc-document-model';

export const KYC_DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const KYC_PDF_MIME = 'application/pdf';

export async function exportKycDocx(payload: KycExportPayload, documentVersion: number, generatedAt?: Date) {
  const [model, letterhead] = await Promise.all([buildKycDocumentModel(payload, documentVersion, generatedAt), loadLetterhead()]);
  return renderKycDocx(model, letterhead);
}

export async function exportKycPdf(payload: KycExportPayload, documentVersion: number, renderer: KycPdfRenderer, generatedAt?: Date) {
  const [model, letterhead] = await Promise.all([buildKycDocumentModel(payload, documentVersion, generatedAt), loadLetterhead()]);
  return renderer.render(renderKycHtml(model), { ...pdfHeaderFooter(letterhead), marginLeftMm: PDF_MARGIN_MM.left, marginRightMm: PDF_MARGIN_MM.right });
}

// Used by the QA preview script to inspect the PDF source without Chromium.
export async function exportKycHtml(payload: KycExportPayload, documentVersion: number, generatedAt?: Date) {
  return renderKycHtml(await buildKycDocumentModel(payload, documentVersion, generatedAt));
}
