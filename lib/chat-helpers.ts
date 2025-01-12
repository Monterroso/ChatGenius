import type { SafeUser, DBGroup, Conversation } from '@/types/db';

export const createDirectConversation = (user: SafeUser): Conversation => ({
  id: user.id,
  type: 'direct' as const,
  name: user.name || user.username || ''
});

export const createGroupConversation = (group: DBGroup): Conversation => ({
  id: group.id,
  type: 'group' as const,
  name: group.name
});
