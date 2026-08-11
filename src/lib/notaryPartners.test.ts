import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import {
  assignMatterToNotary,
  canAssignNotaryPartner,
  extractListPayload,
  extractNotaryPartners,
  formatCoverageAreas,
  formatCurrencyIdr,
  getNotaryPartnerById,
  getNotaryPartnerStatusMeta,
  getNotaryPayoutStatusMeta,
  getRatingLabel,
  getSlaLabel,
  getWorkloadLabel,
  normalizeNotaryPartnerStatus,
  normalizeNotaryPayout,
  normalizeNotaryPayoutStatus,
  listAssignedMattersForNotary,
  listNotaryPartners,
  listNotaryPartnerRecommendations,
  listNotaryPayouts,
  normalizeNotaryPartner,
  normalizeNotaryPartnerRecommendation,
  updateNotaryPartnerStatus,
} from './notaryPartners';

describe('notary partner data helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts list payloads from array, items, and data wrappers', () => {
    expect(extractListPayload([{ id: 'a' }])).toHaveLength(1);
    expect(extractListPayload({ items: [{ id: 'b' }] })).toEqual([{ id: 'b' }]);
    expect(extractListPayload({ data: [{ id: 'c' }] })).toEqual([{ id: 'c' }]);
    expect(extractListPayload({ data: { id: 'not-list' } })).toEqual([]);
  });

  it('normalizes camelCase and snake_case notary partner payloads', () => {
    const camel = normalizeNotaryPartner({
      notaryProfileId: 'np-1',
      userId: 'u-1',
      fullName: 'Raka Pratama',
      email: 'raka@example.dev',
      phone: '0812',
      licenseNumber: 'MN.123',
      status: 'approved',
      acceptsNewAssignment: true,
      jurisdictionCity: 'Jakarta Selatan',
      jurisdictionProvince: 'DKI Jakarta',
      coverageAreas: [{ cityName: 'Jakarta Selatan', provinceName: 'DKI Jakarta', coverageType: 'legal_authority' }],
      activeMattersCount: 4,
      rating: 4.75,
      slaPerformanceScore: 92,
    });

    const snake = normalizeNotaryPartner({
      notary_profile_id: 'np-2',
      user_id: 'u-2',
      full_name: 'Dewi Santoso',
      license_number: 'MN.456',
      status: 'pending_approval',
      accepts_new_assignment: false,
      jurisdiction_city: 'Bandung',
      jurisdiction_province: 'Jawa Barat',
      coverage_areas: [{ city_code: '3273', province_code: '32', coverage_type: 'service_area' }],
      active_matters_count: 2,
      average_rating: 4.2,
      sla_performance_score: 88,
      user: { email: 'dewi@example.dev', phone: '0822' },
    });

    expect(camel).toMatchObject({
      notaryProfileId: 'np-1',
      fullName: 'Raka Pratama',
      status: 'approved',
      acceptsNewAssignment: true,
      jurisdictionCity: 'Jakarta Selatan',
      activeMattersCount: 4,
      rating: 4.75,
      slaPerformanceScore: 92,
    });
    expect(snake).toMatchObject({
      notaryProfileId: 'np-2',
      userId: 'u-2',
      email: 'dewi@example.dev',
      phone: '0822',
      status: 'pending_approval',
      coverageAreas: [{ cityCode: '3273', provinceCode: '32', cityName: '', provinceName: '', coverageType: 'service_area' }],
    });
  });

  it('maps every notary partner and payout status to labels and badge classes', () => {
    expect(getNotaryPartnerStatusMeta('pending_approval')).toEqual({ label: 'Menunggu Approval', className: 'badge-yellow' });
    expect(getNotaryPartnerStatusMeta('approved')).toEqual({ label: 'Approved', className: 'badge-green' });
    expect(getNotaryPartnerStatusMeta('rejected')).toEqual({ label: 'Rejected', className: 'badge-red' });
    expect(getNotaryPartnerStatusMeta('inactive')).toEqual({ label: 'Inactive', className: 'badge-gray' });
    expect(getNotaryPartnerStatusMeta('suspended')).toEqual({ label: 'Suspended', className: 'badge-orange' });

    expect(getNotaryPayoutStatusMeta('pending')).toEqual({ label: 'Pending', className: 'badge-yellow' });
    expect(getNotaryPayoutStatusMeta('paid')).toEqual({ label: 'Paid', className: 'badge-green' });
    expect(getNotaryPayoutStatusMeta('cancelled')).toEqual({ label: 'Cancelled', className: 'badge-gray' });
  });

  it('falls back safely for unknown partner and payout statuses', () => {
    expect(normalizeNotaryPartnerStatus('archived')).toBe('pending_approval');
    expect(normalizeNotaryPartnerStatus(null)).toBe('pending_approval');
    expect(getNotaryPartnerStatusMeta('archived')).toEqual({ label: 'Menunggu Approval', className: 'badge-yellow' });

    expect(normalizeNotaryPayoutStatus('processing')).toBe('pending');
    expect(normalizeNotaryPayoutStatus(undefined)).toBe('pending');
    expect(getNotaryPayoutStatusMeta('processing')).toEqual({ label: 'Pending', className: 'badge-yellow' });
  });

  it('formats coverage areas and empty coverage safely', () => {
    expect(formatCoverageAreas([])).toBe('Coverage belum tersedia');
    expect(formatCoverageAreas([
      { cityCode: '3171', provinceCode: '31', cityName: 'Jakarta Pusat', provinceName: 'DKI Jakarta', coverageType: 'service_area' },
      { cityCode: '3273', provinceCode: '32', cityName: '', provinceName: '', coverageType: 'legal_authority' },
    ])).toBe('Jakarta Pusat, DKI Jakarta • 3273, 32');
  });

  it('returns fallback labels for workload, rating, SLA, email, and phone', () => {
    const partner = normalizeNotaryPartner({ id: 'np-1' });

    expect(partner.email).toBe('-');
    expect(partner.phone).toBe('-');
    expect(getWorkloadLabel(undefined)).toBe('0 perkara aktif');
    expect(getRatingLabel(undefined)).toBe('Belum ada rating');
    expect(getSlaLabel(undefined)).toBe('SLA belum tersedia');
    expect(formatCurrencyIdr(2500000)).toContain('2.500.000');
  });

  it('normalizes null partner payloads without throwing', () => {
    expect(normalizeNotaryPartner(null)).toMatchObject({
      notaryProfileId: '',
      userId: '',
      fullName: 'Notary Partner',
      email: '-',
      phone: '-',
      licenseNumber: '-',
      status: 'pending_approval',
      acceptsNewAssignment: false,
      jurisdictionCity: '',
      jurisdictionProvince: '',
      coverageAreas: [],
      activeMattersCount: 0,
      rating: 0,
      slaPerformanceScore: 0,
    });
  });

  it('normalizes payout fallback fields safely', () => {
    expect(normalizeNotaryPayout({
      id: 'pay-1',
      amount: 'not-a-number',
      status: 'processing',
      matter: { id: 'matter-1' },
      notary_profile: { id: 'np-1' },
      paid_at: '',
    })).toMatchObject({
      id: 'pay-1',
      matterId: 'matter-1',
      matterTitle: '-',
      notaryProfileId: 'np-1',
      notaryName: 'Notary Partner',
      amount: 0,
      status: 'pending',
      createdAt: '',
      paidAt: null,
    });
  });

  it('only allows assignment for approved notaries accepting new assignments', () => {
    expect(canAssignNotaryPartner({ status: 'approved', acceptsNewAssignment: true })).toBe(true);
    expect(canAssignNotaryPartner({ status: 'approved', acceptsNewAssignment: false })).toBe(false);
    expect(canAssignNotaryPartner({ status: 'pending_approval', acceptsNewAssignment: true })).toBe(false);
    expect(canAssignNotaryPartner({ status: 'suspended', acceptsNewAssignment: true })).toBe(false);
  });

  it('normalizes notary partner list responses from API helpers', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        items: [
          {
            notary_profile_id: 'np-1',
            full_name: 'Raka Pratama',
            status: 'approved',
          },
        ],
      },
    });

    const partners = await listNotaryPartners({ status: 'approved', city: 'Jakarta' });

    expect(getSpy).toHaveBeenCalledWith('/api/v1/admin/notary-partners', { status: 'approved', city: 'Jakarta' });
    expect(partners).toHaveLength(1);
    expect(partners[0].notaryProfileId).toBe('np-1');
  });

  it('calls exact mutation endpoints and request bodies', async () => {
    const patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: { notaryProfileId: 'np-1', status: 'approved' } });
    const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: { ok: true } });

    await updateNotaryPartnerStatus('np-1', 'approved');
    await assignMatterToNotary('matter-1', 'np-1');

    expect(patchSpy).toHaveBeenCalledWith('/api/v1/admin/notary-partners/np-1/status', { status: 'approved' });
    expect(postSpy).toHaveBeenCalledWith('/api/v1/matters/matter-1/assignment/decide', { notaryId: 'np-1' });
  });

  it('rejects display-only partner statuses for approval mutation calls', async () => {
    const patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: { notaryProfileId: 'np-1', status: 'inactive' } });

    await expect(updateNotaryPartnerStatus('np-1', 'inactive' as any)).rejects.toThrow('Unsupported notary partner approval status.');
    await expect(updateNotaryPartnerStatus('np-1', 'suspended' as any)).rejects.toThrow('Unsupported notary partner approval status.');
    expect(patchSpy).not.toHaveBeenCalled();
  });

  it('looks up a notary partner by id through the partner list', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
      data: [
        { notaryProfileId: 'np-1', fullName: 'Raka Pratama', status: 'approved' },
        { notaryProfileId: 'np-2', fullName: 'Dewi Santoso', status: 'pending_approval' },
      ],
    });

    await expect(getNotaryPartnerById('np-2')).resolves.toMatchObject({ notaryProfileId: 'np-2', fullName: 'Dewi Santoso' });
    await expect(getNotaryPartnerById('missing')).resolves.toBeNull();
    expect(getSpy).toHaveBeenCalledWith('/api/v1/admin/notary-partners', {});
  });

  it('lists matters assigned to a notary through the admin matter endpoint', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
      data: { items: [{ id: 'matter-1', title: 'AJB Ruko' }] },
    });

    const matters = await listAssignedMattersForNotary('np-1');

    expect(getSpy).toHaveBeenCalledWith('/api/v1/admin/matters', {
      assignedNotaryProfileId: 'np-1',
      page: 1,
      limit: 100,
    });
    expect(matters).toEqual([{ id: 'matter-1', title: 'AJB Ruko' }]);
  });

  it('lists and normalizes notary partner recommendations from the current assignment endpoint', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        data: [
          {
            notary_profile_id: 'np-1',
            full_name: 'Raka Pratama',
            status: 'approved',
            accepts_new_assignment: true,
            score_reason: 'Cakupan wilayah cocok',
          },
        ],
      },
    });

    const recommendations = await listNotaryPartnerRecommendations('matter-1');

    expect(getSpy).toHaveBeenCalledWith('/api/v1/matters/matter-1/assignment/recommendations');
    expect(recommendations[0]).toMatchObject({
      notaryProfileId: 'np-1',
      fullName: 'Raka Pratama',
      status: 'approved',
      acceptsNewAssignment: true,
      scoreReason: 'Cakupan wilayah cocok',
    });
  });

  it('treats compact recommendation rows as backend-verified assignable candidates', () => {
    expect(normalizeNotaryPartnerRecommendation({
      notaryProfileId: 'np-compact',
      fullName: 'Notaris Compact',
      scoreReason: 'Eligible by policy',
    })).toMatchObject({
      status: 'approved',
      acceptsNewAssignment: true,
    });
  });

  it('calls notary payout list endpoint and normalizes payout rows', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
      data: [
        {
          id: 'pay-1',
          matter_id: 'matter-1',
          notary_profile_id: 'np-1',
          notary_name: 'Raka Pratama',
          amount: 2500000,
          status: 'paid',
        },
      ],
    });

    const payouts = await listNotaryPayouts({ status: 'paid', notaryProfileId: 'np-1' });

    expect(getSpy).toHaveBeenCalledWith('/api/v1/admin/notary-payouts', { status: 'paid', notaryProfileId: 'np-1' });
    expect(payouts[0]).toMatchObject({
      id: 'pay-1',
      matterId: 'matter-1',
      notaryProfileId: 'np-1',
      amount: 2500000,
      status: 'paid',
    });
  });

  it('extracts normalized notary partner arrays from wrappers', () => {
    expect(extractNotaryPartners({ data: [{ id: 'np-1', status: 'approved' }] })).toEqual([
      expect.objectContaining({ notaryProfileId: 'np-1', status: 'approved' }),
    ]);
  });
});
