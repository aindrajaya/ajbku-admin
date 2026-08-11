import { describe, expect, it } from 'vitest';
import { canRequestAssignmentRecommendations, getAssignmentDocumentIssues } from './assignmentEligibility';

describe('assignment eligibility', () => {
  it('allows assignment recommendations when every core document type is validated', () => {
    const documents = [
      { document_type: 'ktp', verification_status: 'validated' },
      { document_type: 'npwp', verification_status: 'validated' },
      { document_type: 'sertifikat', verification_status: 'validated' },
      { document_type: 'sppt_pbb', verification_status: 'validated' },
      { document_type: 'kartu_keluarga', verification_status: 'verified' },
    ];

    expect(canRequestAssignmentRecommendations(documents)).toBe(true);
    expect(getAssignmentDocumentIssues(documents)).toEqual([]);
  });

  it('blocks assignment recommendations when core documents are missing or unvalidated', () => {
    const documents = [
      { document_type: 'ktp', verification_status: 'validated' },
      { document_type: 'npwp', verification_status: 'uploaded' },
      { document_type: 'sertifikat', verification_status: 'validated' },
      { document_type: 'pbb', verification_status: 'validated' },
    ];

    expect(canRequestAssignmentRecommendations(documents)).toBe(false);
    expect(getAssignmentDocumentIssues(documents)).toEqual([
      { type: 'npwp', reason: 'unvalidated', status: 'uploaded' },
      { type: 'kk', reason: 'missing' },
    ]);
  });
});
