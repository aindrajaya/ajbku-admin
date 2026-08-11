import { describe, expect, it } from 'vitest';
import { buildVerifyDraftKey, isVerifyFormValid, normalizeVerifyDocumentKey, normalizeVerifyDocType, normalizeVerifyPartyRole, validateVerifyForm } from './verify';

describe('verify helpers', () => {
  it('rejects KTP NIK shorter than 16 digits', () => {
    const errors = validateVerifyForm('ktp', {
      nik: '123456789012345',
      fullName: 'Budi Santoso',
      birthPlace: 'Madiun',
      birthDate: '1990-01-01',
      address: 'Jl. Diponegoro',
      occupation: 'Wiraswasta',
    });

    expect(errors.nik).toBe('NIK harus 16 digit angka.');
    expect(isVerifyFormValid('ktp', {
      nik: '123456789012345',
      fullName: 'Budi Santoso',
      birthPlace: 'Madiun',
      birthDate: '1990-01-01',
      address: 'Jl. Diponegoro',
      occupation: 'Wiraswasta',
    })).toBe(false);
  });

  it('builds draft keys scoped by user and matter', () => {
    expect(buildVerifyDraftKey('matter-1', 'ktp:seller', 'admin-1')).toBe('ajbku-draft-admin-1-matter-1-ktp:seller');
  });

  it('normalizes backend document type aliases used by the viewer', () => {
    expect(normalizeVerifyDocType('npwp')).toBe('npwp');
    expect(normalizeVerifyDocType('kartu-keluarga')).toBe('kk');
    expect(normalizeVerifyDocType('sppt_pbb')).toBe('pbb');
    expect(normalizeVerifyDocType('other')).toBe('lainnya');
    expect(normalizeVerifyPartyRole('penjual')).toBe('seller');
    expect(normalizeVerifyPartyRole('pembeli')).toBe('buyer');
    expect(normalizeVerifyDocumentKey('ktp-penjual')).toBe('ktp:seller');
    expect(normalizeVerifyDocumentKey('npwp-pembeli')).toBe('npwp:buyer');
    expect(normalizeVerifyDocumentKey('kk:buyer')).toBe('kk:buyer');
  });
});
