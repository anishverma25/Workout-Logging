import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { History } from 'lucide-react';
import { db } from '@/data/db';
import { updateWorkoutExerciseNotes } from '@/data/repositories/workouts';

export const NOTE_MAX = 500;
/** Typing is saved this long after the last key, and always when the field is left. */
const SAVE_AFTER_MS = 600;

export interface ExerciseNoteHandle {
  focus: () => void;
}

/**
 * A note on this exercise for this workout, typed right on the card (seat height, grip, how it
 * felt), as in Hevy. Saved as the person types. Last session's note shows underneath until
 * they write their own, with one tap to carry it over.
 *
 * The text is 16 px: iPhone Safari zooms the page into any smaller field it focuses.
 */
export const ExerciseNote = forwardRef<
  ExerciseNoteHandle,
  { workoutExerciseId: string; exerciseName: string; notes: string | null; lastNote: string | null }
>(function ExerciseNote({ workoutExerciseId, exerciseName, notes, lastNote }, ref) {
  const [draft, setDraft] = useState(notes ?? '');
  const field = useRef<HTMLTextAreaElement>(null);
  const editing = useRef(false);
  const saved = useRef(notes ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({ focus: () => field.current?.focus() }), []);

  // A note changed elsewhere (another device, the menu) shows here unless they are typing.
  useEffect(() => {
    if (editing.current) return;
    saved.current = notes ?? '';
    setDraft(notes ?? '');
  }, [notes]);

  // Grows with the text instead of scrolling inside a tiny box, and shrinks back with it.
  const fit = () => {
    const el = field.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(fit, [draft]);
  // The card can change width (rotating the phone, the desktop sidebar).
  useEffect(() => {
    const el = field.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const watch = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  const save = (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (text.trim() === saved.current.trim()) return;
    saved.current = text;
    void updateWorkoutExerciseNotes(db, workoutExerciseId, text);
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const showLast = !!lastNote && !draft.trim();

  return (
    <div className="mx-4 mt-2" data-exercise-note>
      <label htmlFor={`note-${workoutExerciseId}`} className="sr-only">
        Note for {exerciseName}
      </label>
      <textarea
        id={`note-${workoutExerciseId}`}
        ref={field}
        rows={1}
        value={draft}
        maxLength={NOTE_MAX}
        enterKeyHint="done"
        placeholder="Add a note"
        onFocus={() => {
          editing.current = true;
        }}
        onBlur={(e) => {
          editing.current = false;
          save(e.currentTarget.value);
        }}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => save(text), SAVE_AFTER_MS);
        }}
        onKeyDown={(e) => {
          // Return closes the keyboard, as "done" says; Shift+Return adds a line.
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        className="-mx-2 block w-[calc(100%+1rem)] resize-none overflow-hidden rounded-field bg-transparent px-2 py-1.5 text-[16px] leading-snug text-text-1 outline-none placeholder:text-text-3 focus:bg-surface-2"
      />
      {showLast ? (
        <div className="type-meta mt-0.5 flex items-start gap-2 text-text-2" data-last-note>
          <History className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 break-words">Last time: {lastNote}</span>
          <button
            type="button"
            onClick={() => {
              setDraft(lastNote ?? '');
              save(lastNote ?? '');
            }}
            className="pressable shrink-0 font-semibold text-text-1"
            aria-label={`Use last time's note for ${exerciseName}`}
          >
            Use
          </button>
        </div>
      ) : null}
    </div>
  );
});
