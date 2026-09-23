import { api } from '../api/client';

export type IdentityStatus = 'unverified' | 'pending_review' | 'needs_revision' | 'verified' | 'rejected';
export type IdentityDocument = { documentId: string; documentType: 'ktp'; fileName: string; mimeType: string; fileSizeBytes: number; versionNumber: number; verificationStatus: string; uploadedAt: string; verifiedAt?: string | null; revisionNote?: string | null; downloadEndpoint?: string };
export type IdentityReviewSummary = { clientProfileId: string; userId: string; fullName?: string | null; email?: string | null; phone?: string | null; profileCompletionStatus: 'incomplete' | 'complete'; identityVerificationStatus: IdentityStatus; identityRevisionNote?: string | null; latestDocument?: IdentityDocument | null; uploadedAt?: string | null; verifiedAt?: string | null };
export type IdentityReviewDetail = IdentityReviewSummary & { addressLine?: string | null; city?: string | null; province?: string | null; postalCode?: string | null; domicile?: string | null; identityVerifiedAt?: string | null; identityVerifiedBy?: string | null; documents: IdentityDocument[] };
export type IdentityReviewList = { items: IdentityReviewSummary[]; meta: { page: number; limit: number; total: number } };

export const fetchIdentityReviews = (params: { status?: IdentityStatus; page: number; limit: number }) => api.get<IdentityReviewList>('/api/v1/admin/client-identity-verifications', params).then((r) => r.data);
export const fetchIdentityReview = (clientProfileId: string) => api.get<IdentityReviewDetail>(`/api/v1/admin/client-identity-verifications/${clientProfileId}`).then((r) => r.data);
export const decideIdentityReview = (clientProfileId: string, action: 'approve' | 'request-revision' | 'reject', note?: string) => api.post<IdentityReviewDetail>(`/api/v1/admin/client-identity-verifications/${clientProfileId}/${action}`, action === 'approve' ? {} : { note }).then((r) => r.data);
export const identityStatusLabel = (status: string) => ({ unverified: 'Belum verifikasi', pending_review: 'Menunggu review', needs_revision: 'Perlu revisi', verified: 'Terverifikasi', rejected: 'Ditolak' }[status] || status);
