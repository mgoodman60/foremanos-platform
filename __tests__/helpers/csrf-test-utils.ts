export const TEST_CSRF_TOKEN = 'test-csrf-token';

/**
 * Adds a matching CSRF cookie/header pair for mutation-route tests.
 */
export function withMutationCsrfHeaders(
  headers: Record<string, string> = {},
  token: string = TEST_CSRF_TOKEN
): Record<string, string> {
  const existingCookie = headers.cookie ?? headers.Cookie;
  const csrfCookie = `__Host-csrf-token=${token}`;
  const cookie = existingCookie ? `${existingCookie}; ${csrfCookie}` : csrfCookie;

  return {
    ...headers,
    cookie,
    'x-csrf-token': token,
  };
}
