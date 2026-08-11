import { normalizeVerifyDocType, type VerifyDocType } from './verify';

export const CORE_ASSIGNMENT_DOC_TYPES: VerifyDocType[] = ['ktp', 'npwp', 'sertifikat', 'pbb', 'kk'];
const VALID_ASSIGNMENT_DOC_STATUSES = ['validated', 'verified'];

export type AssignmentDocumentIssue = {
  type: VerifyDocType;
  reason: 'missing' | 'unvalidated';
  status?: string;
};

function normalizeDocumentStatus(doc: any) {
  return String(doc?.status || doc?.verificationStatus || doc?.verification_status || '').toLowerCase();
}

export function getAssignmentDocumentIssues(documents: unknown): AssignmentDocumentIssue[] {
  const rows = Array.isArray(documents) ? documents : [];
  const docsByType = new Map<VerifyDocType, string[]>();

  rows.forEach((doc: any) => {
    const docType = normalizeVerifyDocType(doc?.docType || doc?.documentType || doc?.document_type);
    if (!docType || docType === 'lainnya' || !CORE_ASSIGNMENT_DOC_TYPES.includes(docType)) return;

    const statuses = docsByType.get(docType) || [];
    statuses.push(normalizeDocumentStatus(doc));
    docsByType.set(docType, statuses);
  });

  const issues: AssignmentDocumentIssue[] = [];

  CORE_ASSIGNMENT_DOC_TYPES.forEach((type) => {
    const statuses = docsByType.get(type);
    if (!statuses?.length) {
      issues.push({ type, reason: 'missing' });
      return;
    }

    const hasValidatedVersion = statuses.some((status) => VALID_ASSIGNMENT_DOC_STATUSES.includes(status));
    if (hasValidatedVersion) return;

    issues.push({ type, reason: 'unvalidated', status: statuses[0] || 'unknown' });
  });

  return issues;
}

export function canRequestAssignmentRecommendations(documents: unknown) {
  return getAssignmentDocumentIssues(documents).length === 0;
}
