export type VerifyDocType = 'ktp' | 'npwp' | 'sertifikat' | 'pbb' | 'kk' | 'lainnya';

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

export function buildVerifyDraftKey(matterId: string, docType: VerifyDocType, scopeKey: string) {
  return `ajbku-draft-${scopeKey}-${matterId}-${docType}`;
}

export function buildVerifySplitKey(scopeKey: string) {
  return `ajbku-verify-split-width-${scopeKey}`;
}
