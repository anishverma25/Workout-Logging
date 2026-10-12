/**
 * How much of the bottom of the window the on-screen keyboard covers. Android, with the
 * viewport's `interactive-widget=resizes-content`, shrinks the window instead, so this is 0
 * there; iPhone Safari keeps the window and only shrinks the visual viewport, so a sheet
 * pinned to the bottom would sit behind the keyboard without this.
 */
export function keyboardInset(
  innerHeight: number,
  viewport: { height: number; offsetTop: number } | null | undefined,
): number {
  if (!viewport) return 0;
  const covered = Math.round(innerHeight - viewport.height - viewport.offsetTop);
  // Small differences are browser chrome settling, not a keyboard.
  return covered > 80 ? covered : 0;
}
