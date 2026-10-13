// Value formatting shared by every KYC export format, so DOCX and PDF never disagree on wording.

export function text(value: unknown): string {
  if (value === null || value === undefined || value === 'undefined') return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && typeof (value as { toString?: unknown }).toString === 'function') {
    // Prisma.Decimal and similar value objects.
    const rendered = String(value);
    return rendered === '[object Object]' ? '' : rendered.trim();
  }
  return String(value).trim();
}

export function optionText(value: unknown, otherValue?: unknown): string {
  if (Array.isArray(value)) return value.map((item) => optionText(item, otherValue)).filter(Boolean).join(', ');
  if (value === 'Other') return text(otherValue) || 'Other';
  return text(value);
}

export function labelText(value: unknown) {
  return text(value).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

// HIGH -> High, ENHANCED -> Enhanced; mixed-case input is left as entered.
export function enumText(value: unknown) {
  const label = labelText(value);
  if (!label || label !== label.toUpperCase()) return label;
  return (label.charAt(0) + label.slice(1).toLowerCase()).replace(/\b(pep|aml|ubo|qfc|kyc|cr|id|uae|gcc|sef|mlro|dmlro)\b/gi, (word) => word.toUpperCase());
}

export function numberValue(value: unknown) {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function decisionText(value: unknown) {
  const labels: Record<string, string> = {
    APPROVE: 'Approve',
    APPROVE_WITH_CONDITIONS: 'Approve with conditions',
    REJECT: 'Reject',
    REQUEST_ADDITIONAL_INFORMATION: 'Request additional information',
    RETURN_TO_SUPERVISOR: 'Return to AML Supervisor',
    RETURN_TO_DMLRO: 'Return to DMLRO',
    RETURN_TO_MLRO: 'Return to MLRO',
    SEND_TO_SEF: 'Send to SEF'
  };
  const decision = text(value);
  return labels[decision] || enumText(decision);
}

// Removes characters that are illegal in XML 1.0 (commonly pasted from PDFs/Word) so documents never corrupt.
export function cleanText(value: string) {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/\r\n?/g, '\n');
}

export function hasArabic(value: string) {
  return /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(value);
}
