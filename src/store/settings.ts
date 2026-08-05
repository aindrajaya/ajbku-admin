import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TenantProfileDraft {
  officeName: string;
  officeAddress: string;
  officePhone: string;
  logoPreview: string | null;
  logoStorageKey: string | null;
}

export interface TenantRatesDraft {
  baseFee: number;
  njoptkp: number;
  bphtbRate: number;
  pphRate: number;
  certificateCheckFee: number;
  transferNameFee: number;
  extraRates: Record<string, number>;
}

export interface TenantCoverageAreaDraft {
  cityCode: string;
  provinceCode: string;
  coverageType: 'legal_authority' | 'service_area';
}

export interface TenantNotaryDraft {
  notaryProfileId: string;
  userId: string;
  fullName: string;
  licenseNumber: string;
  status: 'active' | 'inactive' | 'suspended';
  acceptsNewAssignment: boolean;
  coverageAreas: TenantCoverageAreaDraft[];
}

interface TenantSettingsSnapshot {
  profile: TenantProfileDraft;
  rates: TenantRatesDraft;
  notaries: TenantNotaryDraft[];
}

interface SettingsState {
  tenantData: Record<string, TenantSettingsSnapshot>;
  hydrateTenant: (tenantId: string, payload: Partial<TenantSettingsSnapshot>) => void;
  saveProfile: (tenantId: string, profile: TenantProfileDraft) => void;
  saveRates: (tenantId: string, rates: TenantRatesDraft) => void;
  saveNotaries: (tenantId: string, notaries: TenantNotaryDraft[]) => void;
  getTenantSettings: (tenantId: string) => TenantSettingsSnapshot;
}

const defaultSnapshot: TenantSettingsSnapshot = {
  profile: {
    officeName: '',
    officeAddress: '',
    officePhone: '',
    logoPreview: null,
    logoStorageKey: null,
  },
  rates: {
    baseFee: 2500000,
    njoptkp: 12000000,
    bphtbRate: 5,
    pphRate: 2.5,
    certificateCheckFee: 500000,
    transferNameFee: 1500000,
    extraRates: {},
  },
  notaries: [],
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      tenantData: {},
      hydrateTenant: (tenantId, payload) =>
        set((state) => ({
          tenantData: {
            ...state.tenantData,
            [tenantId]: {
              ...get().getTenantSettings(tenantId),
              ...payload,
              profile: {
                ...get().getTenantSettings(tenantId).profile,
                ...(payload.profile || {}),
              },
              rates: {
                ...get().getTenantSettings(tenantId).rates,
                ...(payload.rates || {}),
              },
              notaries: payload.notaries || get().getTenantSettings(tenantId).notaries,
            },
          },
        })),
      saveProfile: (tenantId, profile) =>
        set((state) => ({
          tenantData: {
            ...state.tenantData,
            [tenantId]: {
              ...get().getTenantSettings(tenantId),
              profile,
            },
          },
        })),
      saveRates: (tenantId, rates) =>
        set((state) => ({
          tenantData: {
            ...state.tenantData,
            [tenantId]: {
              ...get().getTenantSettings(tenantId),
              rates,
            },
          },
        })),
      saveNotaries: (tenantId, notaries) =>
        set((state) => ({
          tenantData: {
            ...state.tenantData,
            [tenantId]: {
              ...get().getTenantSettings(tenantId),
              notaries,
            },
          },
        })),
      getTenantSettings: (tenantId) => get().tenantData[tenantId] || defaultSnapshot,
    }),
    {
      name: 'ajbku-settings-store',
    }
  )
);
