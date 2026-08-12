export interface MatterActivity {
  id: string;
  title: string;
  description: string;
  actorName?: string;
  createdAt: string;
  aggregateType?: string;
}

export type MatterActivitySource = 'audit' | 'timeline';

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function readDisplayName(...values: unknown[]): string {
  for (const value of values) {
    const text = readString(value);
    if (text && !looksLikeUuid(text)) return text;
  }

  return '';
}

export function extractMatterActivityRows(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === 'object') {
    const data = (payload as Record<string, unknown>).data;
    if (Array.isArray(data)) return data;
  }

  return null;
}

function readableAction(value: string): string {
  return value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeMatterActivities(rows: unknown[], source: MatterActivitySource): MatterActivity[] {
  const activities = rows.flatMap((row, index) => {
    if (!row || typeof row !== 'object') return [];

    const event = row as Record<string, unknown>;
    const rawTitle = source === 'audit'
      ? readString(event.action)
      : readString(event.title) || readString(event.statusCode);
    const title = source === 'audit' ? readableAction(rawTitle) : rawTitle;
    const description = source === 'audit'
      ? readString(event.details)
      : readString(event.description);
    const actorName = source === 'audit'
      ? readDisplayName(event.actorName, event.createdByName, event.createdBy, event.fullName, event.full_name) || 'Sistem'
      : readDisplayName(
        event.actorName,
        event.actorFullName,
        event.actor_full_name,
        event.createdByName,
        event.createdByFullName,
        event.createdBy,
        event.fullName,
        event.full_name,
      ) || (readString(event.actorUserId) || readString(event.actor_user_id) ? 'Admin' : undefined);
    const createdAt = source === 'timeline'
      ? readString(event.happenedAt) || readString(event.createdAt)
      : readString(event.createdAt);
    const aggregateType = source === 'timeline'
      ? readString(event.sourceModule) || readString(event.aggregateType) || undefined
      : readString(event.aggregateType) || undefined;
    const suppliedId = readString(event.id);

    return [{
      id: suppliedId || `${source}-${createdAt || 'unknown-date'}-${title || 'activity'}-${index}`,
      title: title || 'Aktivitas perkara',
      description,
      actorName,
      createdAt,
      aggregateType,
    }];
  });

  return activities.sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    const safeLeftTime = Number.isNaN(leftTime) ? 0 : leftTime;
    const safeRightTime = Number.isNaN(rightTime) ? 0 : rightTime;
    return safeRightTime - safeLeftTime;
  });
}
