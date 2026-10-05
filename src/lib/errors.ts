/** A message a person can act on, from a thrown error or a failed validation. */
export function readableError(err: unknown): string {
  if (err && typeof err === 'object' && 'issues' in err) {
    const issues = (err as { issues: { message: string }[] }).issues;
    return issues[0]?.message ?? 'Check the highlighted fields.';
  }
  return err instanceof Error ? err.message : 'Something went wrong.';
}
