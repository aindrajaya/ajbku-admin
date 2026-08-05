import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Building, Check, DollarSign, Save, Settings, Upload, UserCheck, Users } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import {
  useSettingsStore,
  type TenantCoverageAreaDraft,
  type TenantNotaryDraft,
  type TenantProfileDraft,
  type TenantRatesDraft,
} from '../store/settings';
import { queryKeys } from '../lib/queryKeys';

type ActiveTab = 'profile' | 'staff' | 'notaries' | 'rates';
type NoticeTone = 'success' | 'warning' | 'error';

interface NoticeState {
  tone: NoticeTone;
  message: string;
}

interface TenantSettingsDto {
  id: string;
  code: string;
  name: string;
  status: string;
  address?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  logoStorageKey?: string | null;
}

interface TenantUserItemDto {
  id: string;
  email: string;
  phone?: string | null;
  fullName: string;
  status: string;
  officeId?: string | null;
  officeName?: string | null;
  roles: string[];
  lastLoginAt?: string | null;
}

interface TenantNotaryCoverageAreaDto {
  id?: string;
  cityCode: string;
  provinceCode: string;
  coverageType: 'legal_authority' | 'service_area';
}

interface TenantNotaryItemDto {
  notaryProfileId: string;
  userId: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  licenseNumber: string;
  status: 'active' | 'inactive' | 'suspended';
  acceptsNewAssignment: boolean;
  appointmentCityCode?: string | null;
  appointmentProvinceCode?: string | null;
  coverageAreas: TenantNotaryCoverageAreaDto[];
}

interface TenantRatesDto {
  tenantId: string;
  baseFee?: number;
  njoptkp?: number;
  bphtbRate?: number;
  pphRate?: number;
  certificateCheckFee?: number;
  transferNameFee?: number;
  extraRates?: Record<string, number>;
}

interface PresignedUploadDto {
  bucket: string;
  key: string;
  method: 'PUT';
  url: string;
  token?: string | null;
  expiresIn: number;
}

type InviteRole = 'ADMIN_INTAKE' | 'ADMIN_OFFICE' | 'FINANCE_ADMIN' | 'MODERATION_OFFICER';

function toProfileDraft(tenant: TenantSettingsDto): TenantProfileDraft {
  return {
    officeName: tenant.name || '',
    officeAddress: tenant.address || '',
    officePhone: tenant.phone || '',
    logoPreview: tenant.logoUrl || null,
    logoStorageKey: tenant.logoStorageKey || null,
  };
}

function toRatesDraft(rates?: TenantRatesDto): TenantRatesDraft {
  return {
    baseFee: Number(rates?.baseFee ?? 2500000),
    njoptkp: Number(rates?.njoptkp ?? 12000000),
    bphtbRate: Number(rates?.bphtbRate ?? 5),
    pphRate: Number(rates?.pphRate ?? 2.5),
    certificateCheckFee: Number(rates?.certificateCheckFee ?? 500000),
    transferNameFee: Number(rates?.transferNameFee ?? 1500000),
    extraRates: rates?.extraRates || {},
  };
}

function toNotaryDraft(notary: TenantNotaryItemDto): TenantNotaryDraft {
  return {
    notaryProfileId: notary.notaryProfileId,
    userId: notary.userId,
    fullName: notary.fullName,
    licenseNumber: notary.licenseNumber,
    status: notary.status,
    acceptsNewAssignment: Boolean(notary.acceptsNewAssignment),
    coverageAreas: Array.isArray(notary.coverageAreas)
      ? notary.coverageAreas.map((area) => ({
          cityCode: area.cityCode || '',
          provinceCode: area.provinceCode || '',
          coverageType: area.coverageType || 'service_area',
        }))
      : [],
  };
}

function toNotaryPayload(notary: TenantNotaryDraft) {
  return {
    notaryProfileId: notary.notaryProfileId,
    acceptsNewAssignment: notary.acceptsNewAssignment,
    status: notary.status,
    coverageAreas: notary.coverageAreas.map((area) => ({
      cityCode: area.cityCode.trim(),
      provinceCode: area.provinceCode.trim(),
      coverageType: area.coverageType,
    })),
  };
}

function parseExtraRates(raw: string) {
  if (!raw.trim()) {
    return {};
  }

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('extraRates harus berupa object JSON.');
  }

  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, Number(value)])
  );
}

function serializeExtraRates(extraRates: Record<string, number>) {
  return Object.keys(extraRates).length ? JSON.stringify(extraRates, null, 2) : '';
}

function extractPresignedUpload(payload: any): PresignedUploadDto {
  const candidate = payload?.upload || payload;
  if (!candidate?.url || !candidate?.key) {
    throw new Error('Response presign logo tidak memiliki URL upload yang valid.');
  }
  return candidate as PresignedUploadDto;
}

export default function SettingsView() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>('profile');
  const { user } = useAuth();

  const tenantId = user?.tenantId || 'tenant-id';
  const tenantSettings = useSettingsStore((state) => state.getTenantSettings(tenantId));
  const hydrateTenant = useSettingsStore((state) => state.hydrateTenant);
  const saveProfile = useSettingsStore((state) => state.saveProfile);
  const saveRates = useSettingsStore((state) => state.saveRates);
  const saveNotaries = useSettingsStore((state) => state.saveNotaries);

  const [officeName, setOfficeName] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [officePhone, setOfficePhone] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoStorageKey, setLogoStorageKey] = useState<string | null>(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);

  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffRole, setStaffRole] = useState<InviteRole>('ADMIN_INTAKE');

  const [notaries, setNotaries] = useState<TenantNotaryDraft[]>([]);
  const [rates, setRates] = useState<TenantRatesDraft>(tenantSettings.rates);
  const [extraRatesText, setExtraRatesText] = useState(serializeExtraRates(tenantSettings.rates.extraRates));

  const [profileDirty, setProfileDirty] = useState(false);
  const [notariesDirty, setNotariesDirty] = useState(false);
  const [ratesDirty, setRatesDirty] = useState(false);

  const [profileNotice, setProfileNotice] = useState<NoticeState | null>(null);
  const [staffNotice, setStaffNotice] = useState<NoticeState | null>(null);
  const [notaryNotice, setNotaryNotice] = useState<NoticeState | null>(null);
  const [ratesNotice, setRatesNotice] = useState<NoticeState | null>(null);

  const tenantQuery = useQuery<TenantSettingsDto>({
    queryKey: queryKeys.tenantDetails(tenantId),
    queryFn: async () => {
      const res = await api.get<TenantSettingsDto>(`/api/v1/tenants/${tenantId}`);
      return res.data;
    },
  });

  const staffListQuery = useQuery<TenantUserItemDto[]>({
    queryKey: queryKeys.tenantStaffList(tenantId),
    queryFn: async () => {
      const res = await api.get<TenantUserItemDto[]>(`/api/v1/tenants/${tenantId}/users`);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const notariesQuery = useQuery<TenantNotaryItemDto[]>({
    queryKey: queryKeys.tenantNotaries(tenantId),
    queryFn: async () => {
      const res = await api.get<TenantNotaryItemDto[]>(`/api/v1/tenants/${tenantId}/notaries`);
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const ratesQuery = useQuery<TenantRatesDto>({
    queryKey: queryKeys.tenantRates(tenantId),
    queryFn: async () => {
      const res = await api.get<TenantRatesDto>(`/api/v1/tenants/${tenantId}/rates`);
      return res.data;
    },
  });

  useEffect(() => {
    if (tenantQuery.data && !profileDirty) {
      const draft = toProfileDraft(tenantQuery.data);
      setOfficeName(draft.officeName);
      setOfficeAddress(draft.officeAddress);
      setOfficePhone(draft.officePhone);
      setLogoPreview(draft.logoPreview);
      setLogoStorageKey(draft.logoStorageKey);
      hydrateTenant(tenantId, { profile: draft });
      setProfileNotice(null);
      return;
    }

    if (tenantQuery.isError && tenantSettings.profile.officeName) {
      setOfficeName(tenantSettings.profile.officeName);
      setOfficeAddress(tenantSettings.profile.officeAddress);
      setOfficePhone(tenantSettings.profile.officePhone);
      setLogoPreview(tenantSettings.profile.logoPreview);
      setLogoStorageKey(tenantSettings.profile.logoStorageKey);
      setProfileNotice({
        tone: 'warning',
        message: 'Profile tenant gagal dimuat dari server. Draft lokal dipakai sementara sampai koneksi backend pulih.',
      });
    }
  }, [hydrateTenant, profileDirty, tenantId, tenantQuery.data, tenantQuery.isError, tenantSettings.profile]);

  useEffect(() => {
    if (ratesQuery.data && !ratesDirty) {
      const nextRates = toRatesDraft(ratesQuery.data);
      setRates(nextRates);
      setExtraRatesText(serializeExtraRates(nextRates.extraRates));
      hydrateTenant(tenantId, { rates: nextRates });
      setRatesNotice(null);
      return;
    }

    if (ratesQuery.isError && tenantSettings.rates.baseFee) {
      setRates(tenantSettings.rates);
      setExtraRatesText(serializeExtraRates(tenantSettings.rates.extraRates));
      setRatesNotice({
        tone: 'warning',
        message: 'Tarif gagal dimuat dari server. Draft lokal dipakai sementara dan bukan source of truth final.',
      });
    }
  }, [hydrateTenant, ratesDirty, ratesQuery.data, ratesQuery.isError, tenantId, tenantSettings.rates]);

  useEffect(() => {
    if (notariesQuery.data && !notariesDirty) {
      const nextNotaries = notariesQuery.data.map(toNotaryDraft);
      setNotaries(nextNotaries);
      hydrateTenant(tenantId, { notaries: nextNotaries });
      setNotaryNotice(null);
      return;
    }

    if (notariesQuery.isError && tenantSettings.notaries.length > 0) {
      setNotaries(tenantSettings.notaries);
      setNotaryNotice({
        tone: 'warning',
        message: 'Coverage notaris gagal dimuat dari server. Draft lokal dipakai sementara dan harus diselaraskan lagi.',
      });
    }
  }, [hydrateTenant, notariesDirty, notariesQuery.data, notariesQuery.isError, tenantId, tenantSettings.notaries]);

  const inviteStaffMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/v1/tenants/${tenantId}/invite`, {
        fullName: staffName.trim(),
        email: staffEmail.trim(),
        phone: staffPhone.trim() || undefined,
        roleCode: staffRole,
      });
    },
    onSuccess: async () => {
      setStaffName('');
      setStaffEmail('');
      setStaffPhone('');
      setStaffNotice({
        tone: 'success',
        message: 'Undangan user internal berhasil dikirim. Daftar staf akan dimuat ulang dari server.',
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenantStaffList(tenantId) });
    },
    onError: (error: any) => {
      setStaffNotice({
        tone: 'error',
        message: error?.response?.data?.message || 'Undangan user internal gagal dikirim.',
      });
    },
  });

  const profileMutation = useMutation({
    mutationFn: async () => {
      let nextLogoStorageKey = logoStorageKey;
      let nextLogoUrl = logoPreview;

      if (selectedLogoFile) {
        const presignRes = await api.post<any>(`/api/v1/tenants/${tenantId}/logo/presign`, {
          fileName: selectedLogoFile.name,
          mimeType: selectedLogoFile.type,
        });
        const upload = extractPresignedUpload(presignRes.data);

        await axios.put(upload.url, selectedLogoFile, {
          headers: {
            'Content-Type': selectedLogoFile.type,
          },
        });

        const completeRes = await api.post<TenantSettingsDto>(`/api/v1/tenants/${tenantId}/logo/complete`, {
          storageKey: upload.key,
        });
        nextLogoStorageKey = completeRes.data.logoStorageKey || upload.key;
        nextLogoUrl = completeRes.data.logoUrl || nextLogoUrl;
      }

      const res = await api.patch<TenantSettingsDto>(`/api/v1/tenants/${tenantId}`, {
        name: officeName.trim(),
        address: officeAddress.trim(),
        phone: officePhone.trim(),
        ...(nextLogoStorageKey ? { logoStorageKey: nextLogoStorageKey } : {}),
      });

      return {
        ...res.data,
        logoUrl: res.data.logoUrl ?? nextLogoUrl,
        logoStorageKey: res.data.logoStorageKey ?? nextLogoStorageKey,
      };
    },
    onSuccess: async (data) => {
      const nextProfile = toProfileDraft(data);
      saveProfile(tenantId, nextProfile);
      setOfficeName(nextProfile.officeName);
      setOfficeAddress(nextProfile.officeAddress);
      setOfficePhone(nextProfile.officePhone);
      setLogoPreview(nextProfile.logoPreview);
      setLogoStorageKey(nextProfile.logoStorageKey);
      setSelectedLogoFile(null);
      setProfileDirty(false);
      setProfileNotice({
        tone: 'success',
        message: 'Profile tenant dan branding resmi tersimpan ke server.',
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenantDetails(tenantId) });
    },
    onError: (error: any) => {
      setProfileNotice({
        tone: 'warning',
        message: error?.response?.data?.message || 'Simpan profile gagal. Cache lokal tetap read-only dan tidak di-write-back.',
      });
    },
  });

  const notaryMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch<TenantNotaryItemDto[]>(`/api/v1/tenants/${tenantId}/notaries`, {
        items: notaries.map(toNotaryPayload),
      });
      return Array.isArray(res.data) ? res.data : [];
    },
    onSuccess: async (data) => {
      const nextNotaries = data.map(toNotaryDraft);
      saveNotaries(tenantId, nextNotaries);
      setNotaries(nextNotaries);
      setNotariesDirty(false);
      setNotaryNotice({
        tone: 'success',
        message: 'Coverage notaris berhasil diselaraskan ke server.',
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenantNotaries(tenantId) });
    },
    onError: (error: any) => {
      setNotaryNotice({
        tone: 'warning',
        message: error?.response?.data?.message || 'Simpan coverage notaris gagal. Cache lokal tetap read-only dan tidak di-write-back.',
      });
    },
  });

  const ratesMutation = useMutation({
    mutationFn: async () => {
      const extraRates = parseExtraRates(extraRatesText);
      const payload = {
        baseFee: Number(rates.baseFee),
        njoptkp: Number(rates.njoptkp),
        bphtbRate: Number(rates.bphtbRate),
        pphRate: Number(rates.pphRate),
        certificateCheckFee: Number(rates.certificateCheckFee),
        transferNameFee: Number(rates.transferNameFee),
        extraRates,
      };
      const res = await api.patch<TenantRatesDto>(`/api/v1/tenants/${tenantId}/rates`, payload);
      return toRatesDraft(res.data);
    },
    onSuccess: async (nextRates) => {
      saveRates(tenantId, nextRates);
      setRates(nextRates);
      setExtraRatesText(serializeExtraRates(nextRates.extraRates));
      setRatesDirty(false);
      setRatesNotice({
        tone: 'success',
        message: 'Tarif layanan resmi berhasil tersimpan dan siap dipakai kalkulator intake.',
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenantRates(tenantId) });
    },
    onError: (error: any) => {
      setRatesNotice({
        tone: 'warning',
        message: error?.response?.data?.message || 'Simpan tarif gagal. Cache lokal tetap read-only dan tidak di-write-back.',
      });
    },
  });

  const staffList = staffListQuery.data || [];
  const isProfileServerBacked = Boolean(tenantQuery.data);
  const isRatesServerBacked = Boolean(ratesQuery.data);
  const isNotariesServerBacked = Boolean(notariesQuery.data);

  const ratesPreview = useMemo(() => {
    const baseFee = Number(rates.baseFee || 0);
    const certificateFee = Number(rates.certificateCheckFee || 0);
    const transferFee = Number(rates.transferNameFee || 0);
    return baseFee + certificateFee + transferFee;
  }, [rates.baseFee, rates.certificateCheckFee, rates.transferNameFee]);

  const setRateField = (key: keyof TenantRatesDraft, value: number) => {
    setRates((current) => ({ ...current, [key]: value }));
    setRatesDirty(true);
  };

  const addCoverageArea = (notaryIndex: number) => {
    setNotaries((current) =>
      current.map((notary, index) =>
        index === notaryIndex
          ? {
              ...notary,
              coverageAreas: [
                ...notary.coverageAreas,
                { cityCode: '', provinceCode: '', coverageType: 'service_area' },
              ],
            }
          : notary
      )
    );
    setNotariesDirty(true);
  };

  const updateCoverageArea = (
    notaryIndex: number,
    areaIndex: number,
    field: keyof TenantCoverageAreaDraft,
    value: string
  ) => {
    setNotaries((current) =>
      current.map((notary, index) => {
        if (index !== notaryIndex) {
          return notary;
        }
        return {
          ...notary,
          coverageAreas: notary.coverageAreas.map((area, idx) =>
            idx === areaIndex ? { ...area, [field]: value } : area
          ),
        };
      })
    );
    setNotariesDirty(true);
  };

  const removeCoverageArea = (notaryIndex: number, areaIndex: number) => {
    setNotaries((current) =>
      current.map((notary, index) =>
        index === notaryIndex
          ? {
              ...notary,
              coverageAreas: notary.coverageAreas.filter((_, idx) => idx !== areaIndex),
            }
          : notary
      )
    );
    setNotariesDirty(true);
  };

  const handleInviteStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffNotice(null);
    inviteStaffMutation.mutate();
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileNotice(null);
    profileMutation.mutate();
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 500 * 1024) {
      setProfileNotice({
        tone: 'error',
        message: 'Ukuran file logo maksimal 500 KB.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedLogoFile(file);
      setLogoPreview(reader.result as string);
      setProfileDirty(true);
      setProfileNotice({
        tone: 'warning',
        message: 'Preview logo lokal sudah diperbarui. Logo final baru akan canonical setelah flow presign/upload/complete sukses.',
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="animate-fade-in mx-auto flex max-w-6xl flex-col gap-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Settings size={28} style={{ color: 'var(--color-emerald)' }} />
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Pengaturan Kantor</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Integrasi resmi profile tenant, user internal, coverage notaris, dan tarif layanan dari contract backend terbaru.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]" style={{ alignItems: 'start' }}>
        <div className="glass-panel flex flex-col gap-1 p-2">
          <SettingsTab active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<Building size={16} />} label="Profil Kantor" />
          <SettingsTab active={activeTab === 'staff'} onClick={() => setActiveTab('staff')} icon={<Users size={16} />} label="Kelola Staf" />
          <SettingsTab active={activeTab === 'notaries'} onClick={() => setActiveTab('notaries')} icon={<UserCheck size={16} />} label="Wilayah Notaris" />
          <SettingsTab active={activeTab === 'rates'} onClick={() => setActiveTab('rates')} icon={<DollarSign size={16} />} label="Tarif Layanan" />
        </div>

        <div className="glass-panel min-h-[400px] p-8">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                Profil Tenant & Branding
              </h3>

              <InlineNotice
                notice={
                  profileNotice || {
                    tone: isProfileServerBacked ? 'success' : 'warning',
                    message: isProfileServerBacked ? 'Data profile aktif berasal dari server.' : 'Data profile belum tersinkron dari server.',
                  }
                }
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div
                  style={{
                    width: '90px',
                    height: '90px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-glass)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo Preview" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                  ) : (
                    <Building size={32} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
                <div>
                  <input type="file" id="logo-file" accept="image/png, image/svg+xml" onChange={handleLogoUpload} style={{ display: 'none' }} />
                  <label htmlFor="logo-file" className="btn btn-secondary" style={{ cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
                    <Upload size={14} />
                    Unggah Logo Baru
                  </label>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                    Maksimum 500 KB. Upload final memakai flow presign/complete backend.
                  </span>
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Nama Tampilan Kantor *</label>
                <input type="text" maxLength={60} className="input-field" value={officeName} onChange={(e) => { setOfficeName(e.target.value); setProfileDirty(true); }} required />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Alamat Lengkap Kantor</label>
                <textarea className="input-field" rows={2} value={officeAddress} onChange={(e) => { setOfficeAddress(e.target.value); setProfileDirty(true); }} style={{ resize: 'none' }} />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Nomor Kontak Kantor</label>
                <input type="text" className="input-field" value={officePhone} onChange={(e) => { setOfficePhone(e.target.value); setProfileDirty(true); }} />
              </div>

              <button
                type="submit"
                disabled={profileMutation.isPending}
                className="btn btn-primary"
                style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-start', marginTop: '0.5rem' }}
              >
                <Save size={16} />
                {profileMutation.isPending ? 'Menyimpan...' : 'Simpan Profil'}
              </button>
            </form>
          )}

          {activeTab === 'staff' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {staffNotice && <InlineNotice notice={staffNotice} />}

              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '2rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                    Daftar Pengguna Internal
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {staffListQuery.isLoading ? (
                      <div className="rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-slate-300">
                        Memuat daftar staf dari server...
                      </div>
                    ) : staffList.length === 0 ? (
                      <div className="rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-slate-300">
                        Belum ada pengguna internal terdaftar untuk tenant ini.
                      </div>
                    ) : (
                      staffList.map((staff) => (
                        <div
                          key={staff.id}
                          style={{
                            padding: '0.85rem 1rem',
                            backgroundColor: 'rgba(0,0,0,0.15)',
                            border: '1px solid var(--border-glass)',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.85rem',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, display: 'block' }}>{staff.fullName}</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{staff.email}</span>
                            {staff.officeName ? (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block', marginTop: '0.15rem' }}>
                                Office: {staff.officeName}
                              </span>
                            ) : null}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className={`badge ${staff.status === 'active' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.65rem' }}>
                              {staff.status}
                            </span>
                            <span className="badge badge-teal" style={{ fontSize: '0.65rem' }}>
                              {staff.roles.join(', ')}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <form onSubmit={handleInviteStaffSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                    Undang Pengguna Baru
                  </h3>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Nama Lengkap *</label>
                    <input type="text" className="input-field" placeholder="Contoh: Budi Santoso" value={staffName} onChange={(e) => setStaffName(e.target.value)} required />
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Email Tujuan *</label>
                    <input type="email" className="input-field" placeholder="staf@kantor-notaris.id" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} required />
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Nomor HP (Opsional)</label>
                    <input type="text" className="input-field" placeholder="08123456789" value={staffPhone} onChange={(e) => setStaffPhone(e.target.value)} />
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Role Akses *</label>
                    <select value={staffRole} onChange={(e) => setStaffRole(e.target.value as InviteRole)} className="input-field select-field">
                      <option value="ADMIN_INTAKE" style={{ background: 'var(--bg-secondary)' }}>ADMIN_INTAKE</option>
                      <option value="ADMIN_OFFICE" style={{ background: 'var(--bg-secondary)' }}>ADMIN_OFFICE</option>
                      <option value="FINANCE_ADMIN" style={{ background: 'var(--bg-secondary)' }}>FINANCE_ADMIN</option>
                      <option value="MODERATION_OFFICER" style={{ background: 'var(--bg-secondary)' }}>MODERATION_OFFICER</option>
                    </select>
                  </div>

                  <button type="submit" disabled={inviteStaffMutation.isPending} className="btn btn-primary" style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                    {inviteStaffMutation.isPending ? 'Mengirim...' : 'Kirim Undangan Staf'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'notaries' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                Wilayah Kerja Notaris
              </h3>

              <InlineNotice
                notice={
                  notaryNotice || {
                    tone: isNotariesServerBacked ? 'success' : 'warning',
                    message: isNotariesServerBacked ? 'Coverage notaris aktif berasal dari server.' : 'Coverage notaris belum tersinkron dari server.',
                  }
                }
              />

              {notaries.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-slate-300">
                  Belum ada notaris internal terdaftar untuk tenant ini.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {notaries.map((notary, index) => (
                    <div key={notary.notaryProfileId} style={{ padding: '1rem', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{notary.fullName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lisensi: {notary.licenseNumber}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                            <input
                              type="checkbox"
                              checked={notary.acceptsNewAssignment}
                              onChange={(e) => {
                                setNotaries((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, acceptsNewAssignment: e.target.checked } : item
                                  )
                                );
                                setNotariesDirty(true);
                              }}
                            />
                            Terima assignment baru
                          </label>
                          <select
                            className="input-field select-field"
                            value={notary.status}
                            onChange={(e) => {
                              setNotaries((current) =>
                                current.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, status: e.target.value as TenantNotaryDraft['status'] } : item
                                )
                              );
                              setNotariesDirty(true);
                            }}
                            style={{ width: '150px' }}
                          >
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                            <option value="suspended">suspended</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {notary.coverageAreas.map((area, areaIndex) => (
                          <div key={`${notary.notaryProfileId}-${areaIndex}`} style={{ display: 'grid', gridTemplateColumns: '140px 140px 1fr auto', gap: '0.75rem', alignItems: 'center' }}>
                            <input
                              className="input-field"
                              value={area.provinceCode}
                              onChange={(e) => updateCoverageArea(index, areaIndex, 'provinceCode', e.target.value)}
                              placeholder="Province code"
                            />
                            <input
                              className="input-field"
                              value={area.cityCode}
                              onChange={(e) => updateCoverageArea(index, areaIndex, 'cityCode', e.target.value)}
                              placeholder="City code"
                            />
                            <select
                              className="input-field select-field"
                              value={area.coverageType}
                              onChange={(e) => updateCoverageArea(index, areaIndex, 'coverageType', e.target.value)}
                            >
                              <option value="legal_authority">legal_authority</option>
                              <option value="service_area">service_area</option>
                            </select>
                            <button type="button" className="btn btn-secondary" onClick={() => removeCoverageArea(index, areaIndex)}>
                              Hapus
                            </button>
                          </div>
                        ))}
                      </div>

                      <button type="button" className="btn btn-secondary" style={{ marginTop: '0.75rem' }} onClick={() => addCoverageArea(index)}>
                        Tambah Coverage Area
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                disabled={notaryMutation.isPending}
                className="btn btn-primary"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => {
                  setNotaryNotice(null);
                  notaryMutation.mutate();
                }}
              >
                <Save size={16} />
                {notaryMutation.isPending ? 'Menyimpan...' : 'Simpan Coverage'}
              </button>
            </div>
          )}

          {activeTab === 'rates' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setRatesNotice(null);
                ratesMutation.mutate();
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                Pengaturan Tarif Layanan
              </h3>

              <InlineNotice
                notice={
                  ratesNotice || {
                    tone: isRatesServerBacked ? 'success' : 'warning',
                    message: isRatesServerBacked ? 'Tarif aktif berasal dari server.' : 'Tarif belum tersinkron dari server.',
                  }
                }
              />

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Base Fee (Rp) *</label>
                <input type="number" className="input-field" value={rates.baseFee} onChange={(e) => setRateField('baseFee', Number(e.target.value))} required />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">NJOPTKP (Rp) *</label>
                <input type="number" className="input-field" value={rates.njoptkp} onChange={(e) => setRateField('njoptkp', Number(e.target.value))} required />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">BPHTB Rate (%)</label>
                <input type="number" step="0.01" className="input-field" value={rates.bphtbRate} onChange={(e) => setRateField('bphtbRate', Number(e.target.value))} />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">PPh Rate (%)</label>
                <input type="number" step="0.01" className="input-field" value={rates.pphRate} onChange={(e) => setRateField('pphRate', Number(e.target.value))} />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Certificate Check Fee (Rp)</label>
                <input type="number" className="input-field" value={rates.certificateCheckFee} onChange={(e) => setRateField('certificateCheckFee', Number(e.target.value))} />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Transfer Name Fee (Rp)</label>
                <input type="number" className="input-field" value={rates.transferNameFee} onChange={(e) => setRateField('transferNameFee', Number(e.target.value))} />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Extra Rates (JSON object)</label>
                <textarea
                  className="input-field"
                  rows={6}
                  value={extraRatesText}
                  onChange={(e) => {
                    setExtraRatesText(e.target.value);
                    setRatesDirty(true);
                  }}
                  style={{ fontFamily: 'monospace', resize: 'vertical' }}
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-slate-300">
                Preview total baseline: Rp {ratesPreview.toLocaleString('id-ID')}
              </div>

              <button
                type="submit"
                disabled={ratesMutation.isPending}
                className="btn btn-primary"
                style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-start', marginTop: '0.5rem' }}
              >
                <Check size={16} />
                {ratesMutation.isPending ? 'Menyimpan...' : 'Simpan Tarif'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function InlineNotice({ notice }: { notice: NoticeState }) {
  const palette =
    notice.tone === 'success'
      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
      : notice.tone === 'warning'
        ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
        : 'border-rose-400/30 bg-rose-500/10 text-rose-200';

  return <div className={`rounded-xl border px-4 py-3 text-sm ${palette}`}>{notice.message}</div>;
}

interface SettingsTabProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function SettingsTab({ active, onClick, icon, label }: SettingsTabProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        border: 'none',
        borderRadius: '6px',
        background: active ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
        fontWeight: active ? 600 : 500,
        fontSize: '0.85rem',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'var(--transition-smooth)',
      }}
    >
      <span style={{ color: active ? 'var(--color-emerald)' : 'var(--text-muted)' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
