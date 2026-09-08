export const MAX_UPLOAD_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_FILE_SIZE_LABEL = '10 MB';
export const MAX_UPLOAD_FILE_COUNT = 20;

export const STANDARD_DOCUMENT_ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.jfif,.png,.gif,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png,image/gif,image/webp';

export const SIGNED_KYC_ACCEPT =
  '.pdf,.doc,.docx,.jpg,.jpeg,.jfif,.png,.gif,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/gif,image/webp';

export const PDF_ONLY_ACCEPT = '.pdf,application/pdf';

export const CRRF_DOCUMENT_ACCEPT =
  '.pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const standardExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'jfif', 'png', 'gif', 'webp'];
const pdfExtensions = ['pdf'];
const crrfExtensions = ['pdf', 'xls', 'xlsx'];
const signedKycExtensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'jfif', 'png', 'gif', 'webp'];

export const STANDARD_DOCUMENT_HINT = uploadRuleText('Allowed: PDF, Word, Excel, JPG, PNG, GIF, WEBP');
export const PDF_ONLY_HINT = uploadRuleText('Allowed: PDF only');
export const CRRF_DOCUMENT_HINT = uploadRuleText('Allowed: PDF, XLS, XLSX');
export const SIGNED_KYC_HINT = uploadRuleText('Allowed: PDF, Word, JPG, PNG, GIF, WEBP');

export function validateUploadSelection(files: File[], allowedExtensions = standardExtensions) {
  if (files.length > MAX_UPLOAD_FILE_COUNT) {
    return `Upload a maximum of ${MAX_UPLOAD_FILE_COUNT} files at a time.`;
  }

  const invalidSize = files.find((file) => file.size > MAX_UPLOAD_FILE_SIZE_BYTES);
  if (invalidSize) {
    return `${invalidSize.name} exceeds the ${MAX_UPLOAD_FILE_SIZE_LABEL} upload limit.`;
  }

  const allowed = new Set(allowedExtensions.map((extension) => extension.toLowerCase()));
  const invalidType = files.find((file) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return !allowed.has(extension);
  });

  if (invalidType) {
    return `${invalidType.name} is not an allowed file type.`;
  }

  return '';
}

export function validateStandardDocuments(files: File[]) {
  return validateUploadSelection(files, standardExtensions);
}

export function validatePdfDocuments(files: File[]) {
  return validateUploadSelection(files, pdfExtensions);
}

export function validateCrrfDocuments(files: File[]) {
  return validateUploadSelection(files, crrfExtensions);
}

export function validateSignedKycDocuments(files: File[]) {
  return validateUploadSelection(files, signedKycExtensions);
}

function uploadRuleText(prefix: string) {
  return `${prefix}. Max ${MAX_UPLOAD_FILE_SIZE_LABEL} each, up to ${MAX_UPLOAD_FILE_COUNT} files.`;
}
