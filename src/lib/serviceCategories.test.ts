import { describe, expect, it } from 'vitest';
import { extractServiceCategories, getServiceCategoryName, type ServiceCategory } from './serviceCategories';

const category: ServiceCategory = {
  id: '550e8400-e29b-41d4-a716-446655440001', code: 'AJB-OKE', name: 'AJB - Oke',
  description: 'Balik nama sertipikat tanah', isActive: true, requiresBpn: true,
  requiresNotaryAssignment: true, createdAt: '2026-08-14T10:00:00.000Z', updatedAt: '2026-08-14T10:00:00.000Z',
};

describe('service category catalogue helpers', () => {
  it('normalizes direct and envelope catalogue responses', () => {
    expect(extractServiceCategories([category])).toEqual([category]);
    expect(extractServiceCategories({ data: [category], error: null, meta: { total: 1 } })).toEqual([category]);
  });

  it('prefers the active catalogue name, then embedded historical names', () => {
    expect(getServiceCategoryName({ serviceCategoryId: category.id, serviceName: 'Old label' }, [category])).toBe('AJB - Oke');
    expect(getServiceCategoryName({ serviceCategoryId: 'inactive-id', serviceCategory: { name: 'Legacy AJB' } }, [category])).toBe('Legacy AJB');
    expect(getServiceCategoryName({ serviceCategoryId: 'unknown' }, [category])).toBe('Layanan tidak tersedia');
  });
});
