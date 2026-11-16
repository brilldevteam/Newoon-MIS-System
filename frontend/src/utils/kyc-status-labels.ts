const kycStatusLabels: Record<string, string> = {
  INQUIRY_RECEIVED: 'INQUIRY RECEIVED',
  PROPOSAL_OPTIONAL: 'PROPOSAL OPTIONAL',
  // Wording says who holds the case, so Operations can see it has reached AML.
  LEGAL_DOCUMENTS_PENDING: 'WITH AML – KYC DOCUMENTS PENDING',
  LEGAL_DOCUMENTS_UPLOADED: 'WITH AML – KYC PREPARATION',
  RETURNED_TO_BD: 'RETURNED TO BD FOR CORRECTION',
  SUBMITTED_TO_AML: 'SUBMITTED FOR APPROVAL',
  AML_REVIEW_STARTED: 'APPROVAL REVIEW STARTED',
  SUPERVISOR_REVIEW_PENDING: 'AML SUPERVISOR REVIEW PENDING',
  SUPERVISOR_REVIEW_IN_PROGRESS: 'AML SUPERVISOR REVIEW IN PROGRESS',
  SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED: 'AML SUPERVISOR ADDITIONAL INFORMATION REQUIRED',
  SUPERVISOR_REVIEW_COMPLETED: 'AML SUPERVISOR REVIEW COMPLETED',
  DMLRO_REVIEW_PENDING: 'DMLRO REVIEW PENDING',
  DMLRO_REVIEW_IN_PROGRESS: 'DMLRO REVIEW IN PROGRESS',
  DMLRO_ADDITIONAL_INFORMATION_REQUIRED: 'DMLRO ADDITIONAL INFORMATION REQUIRED',
  DMLRO_REVIEW_COMPLETED: 'DMLRO REVIEW COMPLETED',
  MLRO_REVIEW_PENDING: 'MLRO REVIEW PENDING',
  MLRO_REVIEW_IN_PROGRESS: 'MLRO REVIEW IN PROGRESS',
  MLRO_ADDITIONAL_INFORMATION_REQUIRED: 'MLRO ADDITIONAL INFORMATION REQUIRED',
  MLRO_APPROVED: 'KYC APPROVED',
  MLRO_APPROVED_WITH_CONDITIONS: 'KYC APPROVED WITH CONDITIONS',
  MLRO_REJECTED: 'MLRO REJECTED',
  SEF_DECISION_PENDING: 'SEF DECISION PENDING',
  SEF_DECISION_IN_PROGRESS: 'SEF DECISION IN PROGRESS',
  SEF_APPROVED: 'KYC APPROVED',
  SEF_REJECTED: 'SEF REJECTED',
  FINAL_SIGNATURES_PENDING: 'FINAL SIGNATURES PENDING',
  FINAL_DOCUMENTS_PENDING: 'FINAL DOCUMENTS PENDING',
  KYC_FINAL_APPROVED: 'KYC FINAL APPROVED',
  CLIENT_ACTIVATION_PENDING: 'CLIENT ACTIVATION PENDING',
  CLIENT_ACTIVE: 'CLIENT ACTIVE',
  CLIENT_REJECTED: 'CLIENT REJECTED',
  CLIENT_ON_HOLD: 'CLIENT ON HOLD'
};

export function kycStatusLabel(value: string) {
  return kycStatusLabels[value] || value.split('_').join(' ');
}

export function kycStatusToneClass(value: string) {
  if (['MLRO_APPROVED', 'MLRO_APPROVED_WITH_CONDITIONS', 'SEF_APPROVED', 'KYC_FINAL_APPROVED', 'CLIENT_ACTIVATION_PENDING', 'CLIENT_ACTIVE'].includes(value)) {
    return 'bg-emerald-50 text-emerald-700';
  }

  if (['MLRO_REJECTED', 'SEF_REJECTED', 'CLIENT_REJECTED'].includes(value)) {
    return 'bg-red-50 text-red-700';
  }

  if (value === 'RETURNED_TO_BD' || value.includes('ADDITIONAL_INFORMATION') || value.includes('DOCUMENTS_REQUIRED') || value.includes('PENDING')) {
    return 'bg-amber-50 text-amber-700';
  }

  if (value.includes('IN_PROGRESS') || value.includes('SUBMITTED') || value.includes('UPLOADED') || value.includes('COMPLETED')) {
    return 'bg-blue-50 text-blue-700';
  }

  return 'bg-slate-100 text-slate-700';
}

// Who must act next on a KYC case, shown as "Now with: …" so every role can see where the case sits.
const amlPreparation = ['INQUIRY_RECEIVED', 'PROPOSAL_OPTIONAL', 'LEGAL_DOCUMENTS_PENDING', 'LEGAL_DOCUMENTS_UPLOADED', 'SUBMITTED_TO_AML', 'AML_REVIEW_STARTED', 'SUPERVISOR_REVIEW_PENDING', 'SUPERVISOR_REVIEW_IN_PROGRESS', 'SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED', 'DMLRO_ADDITIONAL_INFORMATION_REQUIRED', 'MLRO_ADDITIONAL_INFORMATION_REQUIRED', 'FINAL_SIGNATURES_PENDING', 'FINAL_DOCUMENTS_PENDING'];

export function kycStatusOwner(value: string): string | null {
  if (amlPreparation.includes(value)) return 'AML Team';
  if (['SUPERVISOR_REVIEW_COMPLETED', 'DMLRO_REVIEW_PENDING', 'DMLRO_REVIEW_IN_PROGRESS'].includes(value)) return 'DMLRO';
  if (['DMLRO_REVIEW_COMPLETED', 'MLRO_REVIEW_PENDING', 'MLRO_REVIEW_IN_PROGRESS'].includes(value)) return 'MLRO';
  if (['SEF_DECISION_PENDING', 'SEF_DECISION_IN_PROGRESS'].includes(value)) return 'SEF';
  if (['MLRO_APPROVED', 'MLRO_APPROVED_WITH_CONDITIONS', 'SEF_APPROVED'].includes(value)) return 'AML Supervisor / MLRO';
  if (['RETURNED_TO_BD', 'KYC_FINAL_APPROVED', 'CLIENT_ACTIVATION_PENDING', 'CLIENT_ON_HOLD'].includes(value)) return 'Operations';
  return null;
}

const nextSteps: Record<string, string> = {
  LEGAL_DOCUMENTS_PENDING: 'AML team: upload the KYC preparation documents, then complete screening and CRRF and submit to DMLRO.',
  SUPERVISOR_ADDITIONAL_INFORMATION_REQUIRED: 'AML team: update the KYC file as requested and resubmit to DMLRO.',
  DMLRO_ADDITIONAL_INFORMATION_REQUIRED: 'AML team: provide the information DMLRO requested.',
  MLRO_ADDITIONAL_INFORMATION_REQUIRED: 'AML team: provide the information MLRO requested.',
  SUPERVISOR_REVIEW_COMPLETED: 'DMLRO: review the KYC and send it to MLRO or return it to AML.',
  DMLRO_REVIEW_PENDING: 'DMLRO: review the KYC and send it to MLRO or return it to AML.',
  DMLRO_REVIEW_IN_PROGRESS: 'DMLRO: finish the review and send it to MLRO or return it to AML.',
  DMLRO_REVIEW_COMPLETED: 'MLRO: approve, send to SEF, or return to DMLRO.',
  MLRO_REVIEW_PENDING: 'MLRO: approve, send to SEF, or return to DMLRO.',
  MLRO_REVIEW_IN_PROGRESS: 'MLRO: finish the review and approve, send to SEF, or return to DMLRO.',
  SEF_DECISION_PENDING: 'SEF: approve or return to MLRO.',
  SEF_DECISION_IN_PROGRESS: 'SEF: approve or return to MLRO.',
  MLRO_APPROVED: 'AML Supervisor, DMLRO or MLRO: confirm this is the final KYC.',
  MLRO_APPROVED_WITH_CONDITIONS: 'AML Supervisor, DMLRO or MLRO: confirm this is the final KYC.',
  SEF_APPROVED: 'Confirm this is the final KYC.',
  KYC_FINAL_APPROVED: 'Operations: attach the signed engagement letter and convert to client.',
  CLIENT_ACTIVATION_PENDING: 'Operations: attach the signed engagement letter and convert to client.',
  RETURNED_TO_BD: 'Operations: correct the enquiry and resubmit it to the AML Supervisor.',
  CLIENT_ON_HOLD: 'Engagement on hold. Operations can resume it: upload the new signed engagement letter and convert to client.',
  CLIENT_ACTIVE: 'Client is active. Ongoing compliance continues in Compliance Clients.',
  CLIENT_REJECTED: 'Engagement rejected.',
  MLRO_REJECTED: 'KYC rejected by MLRO.',
  SEF_REJECTED: 'KYC rejected by SEF.'
};

export function kycNextStep(value: string): string | null {
  if (nextSteps[value]) return nextSteps[value];
  if (amlPreparation.includes(value)) return 'AML team: complete screening and CRRF, then submit to DMLRO.';
  return null;
}

