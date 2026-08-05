export interface ChatThread {
  threadId: string;
  matterId: string;
  matterCaseNumber: string;
  counterpartyName: string;
  counterpartyRole: string;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderUserId: string | null;
  senderName: string;
  senderRole: string;
  messageType: 'text';
  bodyText: string;
  status: string | null;
  isBlocked: boolean;
  isFlagged: boolean;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  matterId?: string;
  actionLabel?: string;
  actionPath?: string;
}

export function normalizeBodyText(bodyText: unknown): string {
  if (typeof bodyText === 'string') return bodyText;
  if (bodyText === null || bodyText === undefined) return '';
  if (typeof bodyText === 'object') {
    const obj = bodyText as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.content === 'string') return obj.content;
    return JSON.stringify(bodyText);
  }
  return String(bodyText);
}

export function normalizeChatThread(input: any): ChatThread {
  return {
    threadId: String(input?.threadId || ''),
    matterId: String(input?.matterId || ''),
    matterCaseNumber: String(input?.matterCaseNumber || ''),
    counterpartyName: String(input?.counterpartyName || ''),
    counterpartyRole: String(input?.counterpartyRole || ''),
    lastMessage: normalizeBodyText(input?.lastMessage),
    lastMessageAt: input?.lastMessageAt ? String(input.lastMessageAt) : null,
    unreadCount: Number(input?.unreadCount || 0),
  };
}

export function normalizeChatMessage(input: any): ChatMessage {
  return {
    id: String(input?.id || ''),
    threadId: String(input?.threadId || ''),
    senderUserId: input?.senderUserId ? String(input.senderUserId) : null,
    senderName: String(input?.senderName || ''),
    senderRole: String(input?.senderRole || ''),
    messageType: 'text',
    bodyText: normalizeBodyText(input?.bodyText),
    status: input?.status ? String(input.status) : null,
    isBlocked: Boolean(input?.isBlocked),
    isFlagged: Boolean(input?.isFlagged),
    createdAt: String(input?.createdAt || ''),
  };
}

export function normalizeNotificationItem(input: any): NotificationItem {
  return {
    id: String(input?.id || ''),
    type: String(input?.type || ''),
    title: String(input?.title || ''),
    body: String(input?.body ?? input?.message ?? ''),
    isRead: typeof input?.isRead === 'boolean' ? input.isRead : Boolean(input?.read),
    createdAt: String(input?.createdAt || ''),
    matterId: input?.matterId ? String(input.matterId) : undefined,
    actionLabel: input?.actionLabel ? String(input.actionLabel) : undefined,
    actionPath: input?.actionPath ? String(input.actionPath) : undefined,
  };
}
