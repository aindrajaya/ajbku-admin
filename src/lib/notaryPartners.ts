import { api } from '../api/client';
import { extractMatterList } from './matters';

export type NotaryPartnerStatus = 'pending_approval' | 'approved' | 'rejected' | 'inactive' | 'suspended';
export type NotaryPartnerApprovalStatus = 'pending_approval' | 'approved' | 'rejected';
export type NotaryPayoutStatus = 'pending' | 'paid' | 'cancelled';

export interface NotaryCoverageArea {
  cityCode: string;
  provinceCode: string;
  cityName: string;
  provinceName: string;
  coverageType: 'legal_authority' | 'service_area' | string;
}

export interface NotaryPartner {
  notaryProfileId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  status: NotaryPartnerStatus;
  acceptsNewAssignment: boolean;
  jurisdictionCity: string;
  jurisdictionProvince: string;
  coverageAreas: NotaryCoverageArea[];
  activeMattersCount: number;
  rating: number;
  slaPerformanceScore: number;
}

export interface NotaryPartnerRecommendation extends NotaryPartner {
  score: number;
  scoreReason: string;
  distanceKm: number;
}

export interface NotaryPayout {
  id: string;
  matterId: string;
  matterTitle: string;
  notaryProfileId: string;
  notaryName: string;
  amount: number;
  status: NotaryPayoutStatus;
  createdAt: string;
  paidAt: string | null;
}

export interface NotaryPartnerListParams {
  status?: NotaryPartnerStatus;
  city?: string;
  jurisdictionCity?: string;
}

export interface NotaryPayoutListParams {
  status?: NotaryPayoutStatus;
  matterId?: string;
  notaryProfileId?: string;
}

const NOTARY_PARTNER_STATUSES: NotaryPartnerStatus[] = ['pending_approval', 'approved', 'rejected', 'inactive', 'suspended'];
const NOTARY_PARTNER_APPROVAL_STATUSES: NotaryPartnerApprovalStatus[] = ['pending_approval', 'approved', 'rejected'];
const NOTARY_PAYOUT_STATUSES: NotaryPayoutStatus[] = ['pending', 'paid', 'cancelled'];

export const notaryPartnerStatusMeta: Record<NotaryPartnerStatus, { label: string; className: string }> = {
  pending_approval: { label: 'Menunggu Approval', className: 'badge-yellow' },
  approved: { label: 'Approved', className: 'badge-green' },
  rejected: { label: 'Rejected', className: 'badge-red' },
  inactive: { label: 'Inactive', className: 'badge-gray' },
  suspended: { label: 'Suspended', className: 'badge-orange' },
};

export const notaryPayoutStatusMeta: Record<NotaryPayoutStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'badge-yellow' },
  paid: { label: 'Paid', className: 'badge-green' },
  cancelled: { label: 'Cancelled', className: 'badge-gray' },
};

function read(input: any, ...keys: string[]) {
  for (const key of keys) {
    const value = input?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function asText(value: unknown, fallback = '-') {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asStatus<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized as T) ? (normalized as T) : fallback;
}

export function extractListPayload<T = any>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const objectPayload = payload as { items?: unknown; data?: unknown };
    if (Array.isArray(objectPayload.items)) return objectPayload.items as T[];
    if (Array.isArray(objectPayload.data)) return objectPayload.data as T[];
  }
  return [];
}

export function normalizeNotaryPartnerStatus(value: unknown): NotaryPartnerStatus {
  return asStatus(value, NOTARY_PARTNER_STATUSES, 'pending_approval');
}

export function normalizeNotaryPayoutStatus(value: unknown): NotaryPayoutStatus {
  return asStatus(value, NOTARY_PAYOUT_STATUSES, 'pending');
}

export function isNotaryPartnerApprovalStatus(status: NotaryPartnerStatus): status is NotaryPartnerApprovalStatus {
  return NOTARY_PARTNER_APPROVAL_STATUSES.includes(status as NotaryPartnerApprovalStatus);
}

export function normalizeCoverageArea(input: any): NotaryCoverageArea {
  return {
    cityCode: asText(read(input, 'cityCode', 'city_code'), ''),
    provinceCode: asText(read(input, 'provinceCode', 'province_code'), ''),
    cityName: asText(read(input, 'cityName', 'city_name', 'city'), ''),
    provinceName: asText(read(input, 'provinceName', 'province_name', 'province'), ''),
    coverageType: asText(read(input, 'coverageType', 'coverage_type'), 'service_area'),
  };
}

export function normalizeNotaryPartner(input: any): NotaryPartner {
  const profile = read(input, 'notaryProfile', 'notary_profile', 'notary_profiles') || {};
  const user = read(input, 'user', 'users') || read(profile, 'user', 'users') || {};
  const coverageAreas = extractListPayload(read(input, 'coverageAreas', 'coverage_areas') || read(profile, 'coverageAreas', 'coverage_areas'));

  return {
    notaryProfileId: asText(read(input, 'notaryProfileId', 'notary_profile_id', 'id') || read(profile, 'id'), ''),
    userId: asText(read(input, 'userId', 'user_id') || read(user, 'id'), ''),
    fullName: asText(read(input, 'fullName', 'full_name', 'name') || read(user, 'fullName', 'full_name', 'name'), 'Notary Partner'),
    email: asText(read(input, 'email') || read(user, 'email')),
    phone: asText(read(input, 'phone') || read(user, 'phone')),
    licenseNumber: asText(read(input, 'licenseNumber', 'license_number') || read(profile, 'licenseNumber', 'license_number')),
    status: normalizeNotaryPartnerStatus(read(input, 'status') || read(profile, 'status')),
    acceptsNewAssignment: Boolean(read(input, 'acceptsNewAssignment', 'accepts_new_assignment') ?? read(profile, 'acceptsNewAssignment', 'accepts_new_assignment')),
    jurisdictionCity: asText(read(input, 'jurisdictionCity', 'jurisdiction_city', 'appointmentCityCode', 'appointment_city_code') || read(profile, 'jurisdictionCity', 'jurisdiction_city'), ''),
    jurisdictionProvince: asText(read(input, 'jurisdictionProvince', 'jurisdiction_province', 'appointmentProvinceCode', 'appointment_province_code') || read(profile, 'jurisdictionProvince', 'jurisdiction_province'), ''),
    coverageAreas: coverageAreas.map(normalizeCoverageArea),
    activeMattersCount: asNumber(read(input, 'activeMattersCount', 'active_matters_count', 'workload') || read(profile, 'activeMattersCount', 'active_matters_count'), 0),
    rating: asNumber(read(input, 'rating', 'averageRating', 'average_rating') || read(profile, 'rating', 'averageRating', 'average_rating'), 0),
    slaPerformanceScore: asNumber(read(input, 'slaPerformanceScore', 'sla_performance_score', 'performanceScore', 'performance_score') || read(profile, 'slaPerformanceScore', 'sla_performance_score'), 0),
  };
}

export function normalizeNotaryPartnerRecommendation(input: any): NotaryPartnerRecommendation {
  const normalized = normalizeNotaryPartner(input);
  const hasExplicitStatus = read(input, 'status') !== undefined || read(input, 'notaryProfile', 'notary_profile', 'notary_profiles')?.status !== undefined;
  const hasExplicitAvailability = read(input, 'acceptsNewAssignment', 'accepts_new_assignment') !== undefined;

  return {
    ...normalized,
    // The assignment recommendations endpoint only returns candidates that the
    // backend already verified as approved and available. Its compact response
    // does not repeat these partner-list fields.
    status: hasExplicitStatus ? normalized.status : 'approved',
    acceptsNewAssignment: hasExplicitAvailability ? normalized.acceptsNewAssignment : true,
    score: asNumber(read(input, 'score', 'matchingScore', 'matching_score'), 0),
    scoreReason: asText(read(input, 'scoreReason', 'score_reason'), 'Sesuai cakupan wilayah dan beban kerja.'),
    distanceKm: asNumber(read(input, 'distanceKm', 'distance_km'), 0),
  };
}

export function normalizeNotaryPayout(input: any): NotaryPayout {
  const matter = read(input, 'matter', 'matters') || {};
  const notary = read(input, 'notary', 'notaryProfile', 'notary_profile') || {};
  const user = read(notary, 'user', 'users') || {};

  return {
    id: asText(read(input, 'id'), ''),
    matterId: asText(read(input, 'matterId', 'matter_id') || read(matter, 'id'), ''),
    matterTitle: asText(read(input, 'matterTitle', 'matter_title') || read(matter, 'title')),
    notaryProfileId: asText(read(input, 'notaryProfileId', 'notary_profile_id') || read(notary, 'id'), ''),
    notaryName: asText(read(input, 'notaryName', 'notary_name') || read(notary, 'fullName', 'full_name') || read(user, 'fullName', 'full_name'), 'Notary Partner'),
    amount: asNumber(read(input, 'amount'), 0),
    status: normalizeNotaryPayoutStatus(read(input, 'status')),
    createdAt: asText(read(input, 'createdAt', 'created_at'), ''),
    paidAt: read(input, 'paidAt', 'paid_at') ? asText(read(input, 'paidAt', 'paid_at'), '') : null,
  };
}

export function extractNotaryPartners(payload: unknown): NotaryPartner[] {
  return extractListPayload(payload).map(normalizeNotaryPartner);
}

export function extractNotaryPartnerRecommendations(payload: unknown): NotaryPartnerRecommendation[] {
  return extractListPayload(payload).map(normalizeNotaryPartnerRecommendation);
}

export function extractNotaryPayouts(payload: unknown): NotaryPayout[] {
  return extractListPayload(payload).map(normalizeNotaryPayout);
}

export function getNotaryPartnerStatusMeta(status: unknown) {
  return notaryPartnerStatusMeta[normalizeNotaryPartnerStatus(status)];
}

export function getNotaryPayoutStatusMeta(status: unknown) {
  return notaryPayoutStatusMeta[normalizeNotaryPayoutStatus(status)];
}

export function formatCoverageAreas(coverageAreas: NotaryCoverageArea[]) {
  if (!coverageAreas.length) return 'Coverage belum tersedia';
  return coverageAreas
    .map((area) => {
      const city = area.cityName || area.cityCode;
      const province = area.provinceName || area.provinceCode;
      return [city, province].filter(Boolean).join(', ');
    })
    .filter(Boolean)
    .join(' • ') || 'Coverage belum tersedia';
}

export function getWorkloadLabel(activeMattersCount: unknown) {
  const count = asNumber(activeMattersCount, 0);
  return `${count} perkara aktif`;
}

export function getRatingLabel(rating: unknown) {
  const value = asNumber(rating, 0);
  return value > 0 ? value.toFixed(1) : 'Belum ada rating';
}

export function getSlaLabel(score: unknown) {
  const value = asNumber(score, 0);
  return value > 0 ? `${Math.round(value)}% SLA` : 'SLA belum tersedia';
}

export function formatCurrencyIdr(amount: unknown) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(asNumber(amount, 0));
}

export function canAssignNotaryPartner(partner: Pick<NotaryPartner, 'status' | 'acceptsNewAssignment'>) {
  return partner.status === 'approved' && partner.acceptsNewAssignment;
}

export async function listNotaryPartners(params: NotaryPartnerListParams = {}) {
  const res = await api.get('/api/v1/admin/notary-partners', params);
  return extractNotaryPartners(res.data);
}

export async function getNotaryPartnerById(notaryProfileId: string) {
  const partners = await listNotaryPartners();
  return partners.find((partner) => partner.notaryProfileId === notaryProfileId) || null;
}

export async function updateNotaryPartnerStatus(notaryProfileId: string, status: NotaryPartnerApprovalStatus) {
  if (!NOTARY_PARTNER_APPROVAL_STATUSES.includes(status)) {
    throw new Error('Unsupported notary partner approval status.');
  }
  const res = await api.patch(`/api/v1/admin/notary-partners/${notaryProfileId}/status`, { status });
  return normalizeNotaryPartner(res.data);
}

export async function assignMatterToNotary(matterId: string, notaryProfileId: string) {
  const res = await api.post(`/api/v1/matters/${matterId}/assignment/decide`, { notaryId: notaryProfileId });
  return res.data;
}

export async function listAssignedMattersForNotary(notaryProfileId: string) {
  const res = await api.get('/api/v1/admin/matters', {
    assignedNotaryProfileId: notaryProfileId,
    page: 1,
    limit: 100,
  });
  return extractMatterList(res.data);
}

export async function listNotaryPartnerRecommendations(matterId: string) {
  const res = await api.get(`/api/v1/matters/${matterId}/assignment/recommendations`);
  return extractNotaryPartnerRecommendations(res.data);
}

export async function listNotaryPayouts(params: NotaryPayoutListParams = {}) {
  const res = await api.get('/api/v1/admin/notary-payouts', params);
  return extractNotaryPayouts(res.data);
}
