export function notificationType(data: Record<string, unknown>) {
  if (data.type === 'call') return 'call';
  if (data.type === 'test') return 'test';
  // Compatibility with message pushes sent by older clients.
  if (data.type === 'message' || typeof data.message_id === 'string') return 'message';
  return null;
}

export function showForeground(data: Record<string, unknown>, chatOpen: boolean, alreadyRead: boolean) {
  return notificationType(data) !== 'message' || (!chatOpen && !alreadyRead);
}
