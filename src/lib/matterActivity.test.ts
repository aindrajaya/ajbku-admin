import { describe, expect, it } from 'vitest';
import { extractMatterActivityRows, normalizeMatterActivities } from './matterActivity';

describe('matter activity normalization', () => {
  it('extracts direct arrays and data envelopes', () => {
    const rows = [{ id: 'event-1' }];

    expect(extractMatterActivityRows(rows)).toEqual(rows);
    expect(extractMatterActivityRows({ data: rows })).toEqual(rows);
    expect(extractMatterActivityRows({ data: { items: rows } })).toBeNull();
    expect(extractMatterActivityRows(null)).toBeNull();
  });

  it('normalizes audit events, supplies stable ids, and sorts newest first', () => {
    const result = normalizeMatterActivities([
      {
        action: 'document_verified',
        details: 'Dokumen lama',
        actorName: 'Admin Satu',
        createdAt: '2026-08-10T08:00:00.000Z',
      },
      {
        id: 'event-new',
        action: 'notary_assigned',
        details: 'Notaris dipilih',
        actorName: 'Admin Dua',
        createdAt: '2026-08-11T08:00:00.000Z',
        aggregateType: 'assignment',
      },
    ], 'audit');

    expect(result.map((event) => event.title)).toEqual(['notary assigned', 'document verified']);
    expect(result[0]).toMatchObject({ id: 'event-new', aggregateType: 'assignment' });
    expect(result[1].id).toContain('audit-2026-08-10T08:00:00.000Z-document verified');
  });

  it('normalizes timeline fields and ignores malformed rows', () => {
    const result = normalizeMatterActivities([
      null,
      'invalid',
      {
        id: 'older',
        statusCode: 'documents_uploaded',
        title: 'Dokumen diunggah',
        actorUserId: 'admin-1',
        happenedAt: '2026-08-10T08:00:00.000Z',
        sourceModule: 'documents',
      },
      {
        id: 'newer',
        statusCode: 'documents_verified',
        title: 'Dokumen diverifikasi',
        description: 'Semua dokumen lengkap',
        actorUserId: 'admin-2',
        actorName: 'Admin AJBKU',
        happenedAt: '2026-08-11T08:00:00.000Z',
        sourceModule: 'verification',
      },
      {
        id: 'system',
        statusCode: 'system_event',
        title: 'Aktivitas sistem',
        happenedAt: '2026-08-09T08:00:00.000Z',
      },
      {
        id: 'created-by-user',
        statusCode: 'matter_created',
        title: 'Perkara dibuat',
        actorUserId: '7fe13f88-19d5-4526-8901-9e0c4d35aa5d',
        createdBy: 'Budi Santoso',
        happenedAt: '2026-08-12T08:00:00.000Z',
      },
    ], 'timeline');

    expect(result).toEqual([
      expect.objectContaining({
        id: 'created-by-user',
        actorName: 'Budi Santoso',
        createdAt: '2026-08-12T08:00:00.000Z',
      }),
      expect.objectContaining({
        id: 'newer',
        title: 'Dokumen diverifikasi',
        description: 'Semua dokumen lengkap',
        actorName: 'Admin AJBKU',
        createdAt: '2026-08-11T08:00:00.000Z',
        aggregateType: 'verification',
      }),
      expect.objectContaining({
        id: 'older',
        actorName: 'Admin',
        createdAt: '2026-08-10T08:00:00.000Z',
        aggregateType: 'documents',
      }),
      expect.objectContaining({
        id: 'system',
        actorName: undefined,
        createdAt: '2026-08-09T08:00:00.000Z',
      }),
    ]);
  });

  it('does not treat UUID-looking createdBy values as display names', () => {
    const result = normalizeMatterActivities([
      {
        id: 'legacy',
        title: 'Perkara dibuat',
        actorUserId: 'actor-1',
        createdBy: '7fe13f88-19d5-4526-8901-9e0c4d35aa5d',
        happenedAt: '2026-08-12T08:00:00.000Z',
      },
    ], 'timeline');

    expect(result[0]).toMatchObject({ actorName: 'Admin' });
  });
});
