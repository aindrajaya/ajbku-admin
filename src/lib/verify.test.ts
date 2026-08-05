import { describe, expect, it } from 'vitest';
import { buildVerifyDraftKey, isVerifyFormValid, validateVerifyForm } from './verify';

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
    expect(buildVerifyDraftKey('matter-1', 'ktp', 'admin-1')).toBe('ajbku-draft-admin-1-matter-1-ktp');
  });
});
