export const queryKeys = {
  tenantDetails: (tenantId: string) => ['tenant-details', tenantId] as const,
  tenantStaffList: (tenantId: string) => ['tenant-staff-list', tenantId] as const,
  tenantNotaries: (tenantId: string) => ['tenant-notaries', tenantId] as const,
  tenantRates: (tenantId: string) => ['tenant-rates', tenantId] as const,
  notificationsList: () => ['notifications.list'] as const,
  moderationFlaggedMessages: (page?: number, perPage?: number) =>
    page && perPage ? (['moderation.flaggedMessages', page, perPage] as const) : (['moderation.flaggedMessages'] as const),
  chatThreads: () => ['chat.threads'] as const,
  chatThread: (threadKey: string) => ['chat.thread', threadKey] as const,
};
