import { describe, expect, it } from 'vitest';
import { canAccess, canAccessSettingsTab, canVerifyDocuments } from './access';

describe('canAccess', () => {
  it('blocks moderator from escrow module', () => {
    expect(canAccess(['MODERATION_OFFICER'], 'escrow')).toBe(false);
  });

  it('allows finance admin to access reports and escrow', () => {
    expect(canAccess(['FINANCE_ADMIN'], 'reports')).toBe(true);
    expect(canAccess(['FINANCE_ADMIN'], 'escrow')).toBe(true);
  });

  it('allows multi-role user when one role matches', () => {
    expect(canAccess(['CLIENT', 'ADMIN_OFFICE'], 'dashboard')).toBe(true);
  });

  it('allows updated document verification roles', () => {
    expect(canVerifyDocuments(['ADMIN_INTAKE'])).toBe(true);
    expect(canVerifyDocuments(['PRINCIPAL'])).toBe(true);
    expect(canVerifyDocuments(['SUPER_ADMIN'])).toBe(true);
    expect(canVerifyDocuments(['ADMIN_OFFICE'])).toBe(true);
    expect(canVerifyDocuments(['FINANCE_ADMIN'])).toBe(false);
  });

  it('exposes settings route to every role with at least one settings tab', () => {
    expect(canAccess(['SUPER_ADMIN'], 'settings')).toBe(true);
    expect(canAccess(['PRINCIPAL'], 'settings')).toBe(true);
    expect(canAccess(['ADMIN_OFFICE'], 'settings')).toBe(true);
    expect(canAccess(['ADMIN_INTAKE'], 'settings')).toBe(true);
    expect(canAccess(['FINANCE_ADMIN'], 'settings')).toBe(true);
    expect(canAccess(['MODERATION_OFFICER'], 'settings')).toBe(false);
  });

  it('matches settings tab visibility to the backend role matrix', () => {
    expect(canAccessSettingsTab(['ADMIN_INTAKE'], 'profile')).toBe(false);
    expect(canAccessSettingsTab(['ADMIN_INTAKE'], 'notaries')).toBe(true);
    expect(canAccessSettingsTab(['FINANCE_ADMIN'], 'rates')).toBe(true);
    expect(canAccessSettingsTab(['FINANCE_ADMIN'], 'staff')).toBe(false);
    expect(canAccessSettingsTab(['ADMIN_OFFICE'], 'profile')).toBe(true);
    expect(canAccessSettingsTab(['ADMIN_OFFICE'], 'staff')).toBe(true);
    expect(canAccessSettingsTab(['ADMIN_OFFICE'], 'notaries')).toBe(true);
    expect(canAccessSettingsTab(['ADMIN_OFFICE'], 'rates')).toBe(true);
  });
});
