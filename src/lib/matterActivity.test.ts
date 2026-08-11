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
    expect(normalizeMatterActivities([
      null,
      'invalid',
      {
        statusCode: 'documents_verified',
        title: 'Dokumen diverifikasi',
        description: 'Semua dokumen lengkap',
        createdBy: 'admin-1',
        createdAt: '2026-08-11T08:00:00.000Z',
      },
    ], 'timeline')).toEqual([
      expect.objectContaining({
        title: 'Dokumen diverifikasi',
        description: 'Semua dokumen lengkap',
        actorName: 'admin-1',
      }),
    ]);
  });
});
