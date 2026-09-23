export type MatterRequirementType = 'document' | 'data_field' | 'physical_original' | 'physical_item' | 'instruction' | 'output_document';

export type MatterRequirementDocument = {
  documentId: string;
  verificationStatus: string;
  fileName?: string | null;
  uploadedAt?: string | null;
  verifiedAt?: string | null;
};

export type MatterRequirement = {
  id: string;
  requirementKey: string;
  requirementInstanceKey?: string | null;
  documentSlotKey: string;
  documentType: string;
  partyRole?: string | null;
  label: string;
  description?: string | null;
  required: boolean;
  requirementType: MatterRequirementType;
  requirementLevel: 'required' | 'conditional' | 'optional';
  condition?: unknown;
  isRepeatable: boolean;
  minCount: number;
  maxCount?: number | null;
  digitalUploadRequired: boolean;
  physicalOriginalRequired: boolean;
  physicalItemRequired: boolean;
  direction: 'input' | 'output';
  status: string;
  displayOrder: number;
  document?: MatterRequirementDocument | null;
};

export type MatterRequirementsSnapshot = {
  matterId: string;
  requirementsConfigured: boolean;
  requirementVersion: number;
  requirements: MatterRequirement[];
};

export function requirementStatusLabel(status: string) {
  return ({ not_applicable: 'Tidak berlaku', missing: 'Belum tersedia', pending_upload: 'Menunggu unggah', uploaded: 'Menunggu verifikasi', under_review: 'Dalam review', verified: 'Terverifikasi', needs_revision: 'Perlu revisi', rejected: 'Ditolak', satisfied: 'Terpenuhi' } as Record<string, string>)[status] || status.replaceAll('_', ' ');
}

export function requirementInstruction(requirement: MatterRequirement) {
  if (requirement.requirementLevel === 'conditional') return 'Perlu keputusan admin: terapkan hanya jika kondisi pada matter terpenuhi.';
  if (requirement.requirementType === 'data_field') return 'Data dicatat dan ditinjau admin; tidak memerlukan unggahan klien.';
  if (requirement.requirementType === 'physical_original') return 'Tinjau penerimaan dokumen asli secara fisik; tidak memerlukan unggahan klien.';
  if (requirement.requirementType === 'physical_item') return 'Tinjau penerimaan item fisik secara manual; tidak memerlukan unggahan klien.';
  if (requirement.requirementType === 'output_document') return 'Dokumen keluaran disiapkan oleh kantor/notaris; bukan unggahan klien.';
  if (requirement.requirementType === 'instruction') return 'Instruksi operasional untuk ditindaklanjuti admin.';
  return requirement.digitalUploadRequired ? 'Unggah berkas untuk slot requirement ini.' : 'Tidak memerlukan unggahan digital.';
}
