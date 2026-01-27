import { getAccessDenialMessage, isRestrictedQuery } from '@/lib/access-control';
import type { AccessLevel } from '@/lib/access-control';
import type { RestrictedQueryResult } from '@/types/chat';

/**
 * Checks if a query is restricted for the given user role.
 *
 * @param message - User's message text (can be null).
 * @param userRole - User's role: admin, client, guest, or pending.
 * @returns Result indicating if query is restricted and denial message.
 *
 * @example
 * const result = await checkRestrictedQuery("What's the budget?", "guest");
 * if (result.isRestricted) {
 *   return result.denialMessage;
 * }
 */
export async function checkRestrictedQuery(
  message: string | null,
  userRole: string
): Promise<RestrictedQueryResult> {
  if (!message) {
    // Image-only queries are not restricted.
    return {
      isRestricted: false,
    };
  }

  const normalizedRole: AccessLevel =
    userRole === 'admin' ||
    userRole === 'client' ||
    userRole === 'guest' ||
    userRole === 'pending'
      ? userRole
      : 'guest';
  const restricted = isRestrictedQuery(message, normalizedRole);

  if (restricted) {
    return {
      isRestricted: true,
      denialMessage: getAccessDenialMessage(),
    };
  }

  return {
    isRestricted: false,
  };
}
