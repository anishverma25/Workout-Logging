/**
 * How much of the bottom of the window the on-screen keyboard covers. Android, with the
 * viewport's `interactive-widget=resizes-content`, shrinks the window instead, so this is 0
 * there; iPhone Safari keeps the window and only shrinks the visual viewport, so a sheet
 * pinned to the bottom would sit behind the keyboard without this.
 *
 * `baseline` is what was already missing from the visual viewport before any keyboard: newer
 * iPhones (iOS 18 and 26 Safari, with its floating bar) report a visual viewport shorter than
 * the window by the browser's own toolbars, which is not a keyboard and must not shrink a sheet.
 */
export function keyboardInset(
  innerHeight: number,
  viewport: { height: number; offsetTop: number } | null | undefined,
  baseline = 0,
): number {
  if (!viewport) return 0;
  const covered = Math.round(innerHeight - viewport.height - viewport.offsetTop) - baseline;
  // Small differences are browser chrome settling, not a keyboard.
  return covered > 80 ? covered : 0;
}

/** What the visual viewport already misses with no keyboard up (see `keyboardInset`). */
export function viewportBaseline(
  innerHeight: number,
  viewport: { height: number; offsetTop: number } | null | undefined,
): number {
  if (!viewport) return 0;
  return Math.max(0, Math.round(innerHeight - viewport.height - viewport.offsetTop));
}

/** True while a field that opens the keyboard has focus. */
export function isEditing(el: Element | null = document.activeElement): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly;
  if (!(el instanceof HTMLInputElement) || el.readOnly) return false;
  return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color'].includes(
    el.type,
  );
}
