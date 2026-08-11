export interface MatterActivity {
  id: string;
  title: string;
  description: string;
  actorName: string;
  createdAt: string;
  aggregateType?: string;
}

export type MatterActivitySource = 'audit' | 'timeline';

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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
    const actorName = readString(event.actorName) || readString(event.createdBy) || 'Sistem';
    const createdAt = readString(event.createdAt);
    const aggregateType = readString(event.aggregateType) || undefined;
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
