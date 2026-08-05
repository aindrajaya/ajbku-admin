import { describe, expect, it } from 'vitest';
import { canAccess } from './access';

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
});
