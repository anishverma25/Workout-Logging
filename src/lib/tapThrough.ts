/**
 * One tap does the job while the keyboard is open.
 *
 * Tapping a button while typing first moves focus away from the field. On phones that closes
 * the keyboard and shifts the screen (sheets grow back, the page scrolls), so the tap often
 * lands on nothing: the first tap closes the keyboard and only the second one works ("Work it
 * out", "Log", "Send").
 *
 * The fix is the standard one: while a text field has focus, pressing a button or link does
 * not take the focus away (the mousedown's default is prevented), so nothing moves and the tap
 * reaches the button. After the button has done its work, the keyboard is closed, unless the
 * button asks to keep it (`data-keep-keyboard`, for + and - while searching foods).
 */

const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'number',
  'tel',
  'url',
  'password',
  'date',
  'time',
  'datetime-local',
]);

export function isTextField(el: Element | null): el is HTMLElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

const CONTROL =
  'button, a[href], [role="button"], [role="radio"], [role="tab"], [role="switch"], [role="checkbox"], [role="menuitem"], [role="option"]';

/** The button or link a press landed on, unless it is (or sits in) a field of its own. */
export function pressedControl(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  if (target.closest('input, textarea, select, label, [contenteditable="true"]')) return null;
  return target.closest(CONTROL);
}

export function keepTapsWhileTyping(doc: Document = document): () => void {
  let pressed: Element | null = null;
  let typing: HTMLElement | null = null;
  const onDown = (e: MouseEvent) => {
    pressed = null;
    typing = null;
    const field = doc.activeElement;
    if (e.button !== 0 || !isTextField(field)) return;
    const control = pressedControl(e.target);
    if (!control || (control as HTMLButtonElement).disabled) return;
    pressed = control;
    typing = field;
    e.preventDefault();
  };
  // Bubbling on the document runs after the app's own click handlers.
  const onClick = (e: MouseEvent) => {
    const control = pressed;
    const field = typing;
    pressed = null;
    typing = null;
    if (!control || !field || !(e.target instanceof Node) || !control.contains(e.target)) return;
    if (control.closest('[data-keep-keyboard]')) return;
    // Only the field that was being typed in: a button that moved focus to another field on
    // purpose ("Add a note") keeps it.
    if (doc.activeElement === field) field.blur();
  };
  doc.addEventListener('mousedown', onDown, true);
  doc.addEventListener('click', onClick);
  return () => {
    doc.removeEventListener('mousedown', onDown, true);
    doc.removeEventListener('click', onClick);
  };
}
