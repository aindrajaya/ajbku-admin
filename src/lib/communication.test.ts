import { describe, expect, it } from 'vitest';
import { normalizeNotificationItem } from './communication';

describe('normalizeNotificationItem', () => {
  it('prefers canonical notification fields', () => {
    const notification = normalizeNotificationItem({
      id: 'notif-1',
      type: 'matter.updated',
      title: 'Perkara berubah',
      body: 'Status verifikasi diperbarui',
      message: 'legacy body',
      isRead: false,
      read: true,
      createdAt: '2026-06-26T10:00:00.000Z',
      matterId: 'matter-1',
      actionPath: '/matters/matter-1',
    });

    expect(notification.title).toBe('Perkara berubah');
    expect(notification.body).toBe('Status verifikasi diperbarui');
    expect(notification.isRead).toBe(false);
    expect(notification.actionPath).toBe('/matters/matter-1');
  });
});
