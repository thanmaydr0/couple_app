export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match. Please try again.';
  if (/email not confirmed/i.test(message)) return 'Your account needs to be confirmed by the admin.';
  if (/rate|too many/i.test(message)) return 'Too many attempts. Please wait a moment and try again.';
  if (/network|fetch|offline/i.test(message)) return 'We couldn’t connect. Check your internet and try again.';
  return 'Something went wrong. Please try again in a moment.';
}
