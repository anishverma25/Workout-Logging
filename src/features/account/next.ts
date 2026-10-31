/** Only same-app paths, so a crafted link cannot send someone to another site after sign-in. */
export function safeNext(value: string | null, fallback = '/account'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return fallback;
  return value;
}
