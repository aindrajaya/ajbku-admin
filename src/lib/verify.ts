export type VerifyDocType = 'ktp' | 'npwp' | 'sertifikat' | 'pbb' | 'kk' | 'lainnya';
export type VerifyPartyRole = 'seller' | 'buyer';
export type VerifyDocumentKey =
  | 'ktp:seller'
  | 'ktp:buyer'
  | 'npwp:seller'
  | 'npwp:buyer'
  | 'kk:seller'
  | 'kk:buyer'
  | 'sertifikat'
  | 'pbb'
  | 'lainnya';

export type VerifyDocumentTab = {
  key: VerifyDocumentKey;
  docType: VerifyDocType;
  partyRole?: VerifyPartyRole;
  label: string;
};

export const verifyDocumentTabs: VerifyDocumentTab[] = [
  { key: 'ktp:seller', docType: 'ktp', partyRole: 'seller', label: 'KTP Penjual' },
  { key: 'ktp:buyer', docType: 'ktp', partyRole: 'buyer', label: 'KTP Pembeli' },
  { key: 'npwp:seller', docType: 'npwp', partyRole: 'seller', label: 'NPWP Penjual' },
  { key: 'npwp:buyer', docType: 'npwp', partyRole: 'buyer', label: 'NPWP Pembeli' },
  { key: 'kk:seller', docType: 'kk', partyRole: 'seller', label: 'KK Penjual' },
  { key: 'kk:buyer', docType: 'kk', partyRole: 'buyer', label: 'KK Pembeli' },
  { key: 'sertifikat', docType: 'sertifikat', label: 'Sertifikat' },
  { key: 'pbb', docType: 'pbb', label: 'PBB' },
  { key: 'lainnya', docType: 'lainnya', label: 'Lainnya' },
];

export function normalizeVerifyDocType(value: unknown): VerifyDocType | '' {
  const raw = String(value || '').toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
  if (!raw) return '';
  if (raw === 'sppt_pbb' || raw.includes('pbb')) return 'pbb';
  if (raw === 'other' || raw === 'lain_lain' || raw === 'lainnya') return 'lainnya';
  if (raw.includes('ktp')) return 'ktp';
  if (raw.includes('npwp')) return 'npwp';
  if (raw.includes('kk') || raw.includes('kartu_keluarga') || raw.includes('family_card')) return 'kk';
  if (raw.includes('sertifikat') || raw.includes('certificate')) return 'sertifikat';
  return '';
}

export function normalizeVerifyPartyRole(value: unknown): VerifyPartyRole | undefined {
  const raw = String(value || '').toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
  if (!raw) return undefined;
  if (raw.includes('seller') || raw.includes('penjual')) return 'seller';
  if (raw.includes('buyer') || raw.includes('pembeli')) return 'buyer';
  return undefined;
}

export function buildVerifyDocumentKey(docType: VerifyDocType, partyRole?: VerifyPartyRole): VerifyDocumentKey {
  if (['ktp', 'npwp', 'kk'].includes(docType)) {
    return `${docType}:${partyRole || 'seller'}` as VerifyDocumentKey;
  }
  return docType as VerifyDocumentKey;
}

export function normalizeVerifyDocumentKey(value: unknown): VerifyDocumentKey | '' {
  const raw = String(value || '').toLowerCase().trim();
  if (!raw) return '';
  const normalized = raw.replace(/\s+/g, '_').replace(/-/g, '_');
  const [typePart, rolePart] = normalized.includes(':') ? normalized.split(':') : [normalized, normalized];
  const docType = normalizeVerifyDocType(typePart);
  if (!docType) return '';
  return buildVerifyDocumentKey(docType, normalizeVerifyPartyRole(rolePart || normalized));
}

export const verifyDocFields: Record<VerifyDocType, Array<{ key: string; label: string; required?: boolean }>> = {
  ktp: [
    { key: 'nik', label: 'NIK', required: true },
    { key: 'fullName', label: 'Nama Lengkap', required: true },
    { key: 'birthPlace', label: 'Tempat Lahir', required: true },
    { key: 'birthDate', label: 'Tanggal Lahir', required: true },
    { key: 'address', label: 'Alamat', required: true },
    { key: 'occupation', label: 'Pekerjaan', required: true },
  ],
  npwp: [
    { key: 'number', label: 'Nomor NPWP', required: true },
    { key: 'name', label: 'Nama Wajib Pajak', required: true },
    { key: 'address', label: 'Alamat', required: true },
  ],
  sertifikat: [
    { key: 'certificateNumber', label: 'Nomor Sertifikat', required: true },
    { key: 'ownerName', label: 'Nama Pemegang Hak', required: true },
    { key: 'landArea', label: 'Luas Tanah', required: true },
  ],
  pbb: [
    { key: 'nop', label: 'NOP', required: true },
    { key: 'taxYear', label: 'Tahun Pajak', required: true },
    { key: 'taxpayerName', label: 'Nama WP', required: true },
  ],
  kk: [
    { key: 'cardNumber', label: 'Nomor KK', required: true },
    { key: 'headOfFamily', label: 'Kepala Keluarga', required: true },
    { key: 'address', label: 'Alamat', required: true },
  ],
  lainnya: [
    { key: 'documentNumber', label: 'Nomor Dokumen', required: true },
    { key: 'documentName', label: 'Nama Dokumen', required: true },
    { key: 'notes', label: 'Catatan Ringkas', required: true },
  ],
};

export function createInitialVerifyForms() {
  return {
    ktp: { nik: '', fullName: '', birthPlace: '', birthDate: '', address: '', occupation: '' },
    npwp: { number: '', name: '', address: '' },
    sertifikat: { certificateNumber: '', ownerName: '', landArea: '' },
    pbb: { nop: '', taxYear: '', taxpayerName: '' },
    kk: { cardNumber: '', headOfFamily: '', address: '' },
    lainnya: { documentNumber: '', documentName: '', notes: '' },
  } as Record<VerifyDocType, Record<string, string>>;
}

export function createInitialVerifyDocumentForms() {
  const baseForms = createInitialVerifyForms();
  return Object.fromEntries(
    verifyDocumentTabs.map((tab) => [tab.key, { ...baseForms[tab.docType] }])
  ) as Record<VerifyDocumentKey, Record<string, string>>;
}

export function validateVerifyForm(docType: VerifyDocType, values: Record<string, string>) {
  const nextErrors: Record<string, string> = {};
  const fields = verifyDocFields[docType];

  fields.forEach((field) => {
    const value = values[field.key]?.trim();
    if (field.required && !value) {
      nextErrors[field.key] = `${field.label} wajib diisi.`;
    }
  });

  if (docType === 'ktp') {
    const nik = values.nik?.trim();
    if (!/^\d{16}$/.test(nik || '')) {
      nextErrors.nik = 'NIK harus 16 digit angka.';
    }
  }

  return nextErrors;
}

export function isVerifyFormValid(docType: VerifyDocType, values: Record<string, string>) {
  return Object.keys(validateVerifyForm(docType, values)).length === 0;
}

export function buildVerifyDraftKey(matterId: string, docKey: VerifyDocumentKey, scopeKey: string) {
  return `ajbku-draft-${scopeKey}-${matterId}-${docKey}`;
}

export function buildVerifySplitKey(scopeKey: string) {
  return `ajbku-verify-split-width-${scopeKey}`;
}
