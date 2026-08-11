import type { AppRole } from '../api/client';

export const routeAccess = {
  dashboard: ['PRINCIPAL', 'SUPER_ADMIN', 'ADMIN_INTAKE', 'ADMIN_OFFICE', 'FINANCE_ADMIN', 'MODERATION_OFFICER'],
  queue: ['PRINCIPAL', 'SUPER_ADMIN', 'ADMIN_INTAKE', 'ADMIN_OFFICE'],
  intakeNew: ['PRINCIPAL', 'SUPER_ADMIN', 'ADMIN_INTAKE', 'ADMIN_OFFICE'],
  matters: ['PRINCIPAL', 'SUPER_ADMIN', 'ADMIN_INTAKE', 'ADMIN_OFFICE', 'FINANCE_ADMIN', 'MODERATION_OFFICER'],
  schedules: ['PRINCIPAL', 'SUPER_ADMIN', 'ADMIN_INTAKE', 'ADMIN_OFFICE'],
  chat: ['PRINCIPAL', 'SUPER_ADMIN', 'ADMIN_INTAKE', 'ADMIN_OFFICE', 'FINANCE_ADMIN', 'MODERATION_OFFICER'],
  escrow: ['PRINCIPAL', 'SUPER_ADMIN', 'FINANCE_ADMIN'],
  moderation: ['PRINCIPAL', 'SUPER_ADMIN', 'MODERATION_OFFICER'],
  reports: ['PRINCIPAL', 'SUPER_ADMIN', 'FINANCE_ADMIN'],
  audit: ['PRINCIPAL', 'SUPER_ADMIN'],
  invitations: ['PRINCIPAL', 'SUPER_ADMIN', 'ADMIN_INTAKE', 'ADMIN_OFFICE'],
  settings: ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN_OFFICE', 'ADMIN_INTAKE', 'FINANCE_ADMIN'],
} satisfies Record<string, AppRole[]>;

export const documentVerificationRoles = ['ADMIN_INTAKE', 'PRINCIPAL', 'SUPER_ADMIN', 'ADMIN_OFFICE'] satisfies AppRole[];

export const settingsAccess = {
  profile: ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN_OFFICE'],
  staff: ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN_OFFICE'],
  notaries: ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN_OFFICE', 'ADMIN_INTAKE'],
  rates: ['SUPER_ADMIN', 'PRINCIPAL', 'ADMIN_OFFICE', 'FINANCE_ADMIN'],
} satisfies Record<string, AppRole[]>;

export function hasAnyRole(roles: readonly AppRole[] | null | undefined, allowed: readonly AppRole[]) {
  if (!roles?.length) return false;
  return roles.some((role) => allowed.includes(role));
}

export function canAccess(roles: readonly AppRole[] | null | undefined, key: keyof typeof routeAccess) {
  return hasAnyRole(roles, routeAccess[key] as readonly AppRole[]);
}

export function canVerifyDocuments(roles: readonly AppRole[] | null | undefined) {
  return hasAnyRole(roles, documentVerificationRoles);
}

export function canAccessSettingsTab(roles: readonly AppRole[] | null | undefined, tab: keyof typeof settingsAccess) {
  return hasAnyRole(roles, settingsAccess[tab] as readonly AppRole[]);
}

export function getPrimaryAdminRole(roles: readonly AppRole[] | null | undefined): AppRole | null {
  if (!roles?.length) return null;
  const priority: AppRole[] = [
    'SUPER_ADMIN',
    'TENANT_OWNER',
    'PRINCIPAL',
    'FINANCE_ADMIN',
    'MODERATION_OFFICER',
    'ADMIN_OFFICE',
    'ADMIN_INTAKE',
  ];
  return priority.find((role) => roles.includes(role)) ?? null;
}
