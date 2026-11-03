import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Bookmark, History, Pin } from 'lucide-react';
import type { NoteKind } from '@/data/repositories/exerciseNotes';
import { PinnedNoteSheet } from './PinnedNoteSheet';
import { KIND_LABEL, type NoteTargets } from './noteKinds';
import { db } from '@/data/db';
import { updateWorkoutExerciseNotes } from '@/data/repositories/workouts';

export const NOTE_MAX = 500;
/** Typing is saved this long after the last key, and always when the field is left. */
const SAVE_AFTER_MS = 600;

export interface ExerciseNoteHandle {
  focus: () => void;
}

export interface NotePins {
  exerciseId: string;
  /** The note pinned to the exercise, shown every time. */
  exercise: string | null;
  /** The routine slot this came from, its name and its pinned note. */
  slotId: string | null;
  routineName: string | null;
  routine: string | null;
}

/**
 * Notes on the card, in three kinds as in Hevy (November 2026): pinned to the exercise (shown
 * every time), pinned to the routine (shown whenever that routine is done), and today's note,
 * typed right on the card and saved as the person types. Last session's note shows under
 * today's until they write their own, with one tap to carry it over. The pin button moves
 * today's note to a pinned kind; tapping a pinned note edits or moves it.
 *
 * The text is 16 px: iPhone Safari zooms the page into any smaller field it focuses.
 */
export const ExerciseNote = forwardRef<
  ExerciseNoteHandle,
  {
    workoutExerciseId: string;
    exerciseName: string;
    notes: string | null;
    lastNote: string | null;
    pins: NotePins;
  }
>(function ExerciseNote({ workoutExerciseId, exerciseName, notes, lastNote, pins }, ref) {
  const [draft, setDraft] = useState(notes ?? '');
  const [sheet, setSheet] = useState<{ kind: NoteKind; text?: string; from?: NoteKind } | null>(
    null,
  );
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
  const targets: NoteTargets = {
    exerciseId: pins.exerciseId,
    exerciseName,
    workoutExerciseId,
    slotId: pins.slotId,
    routineName: pins.routineName,
    current: { exercise: pins.exercise ?? '', routine: pins.routine ?? '', workout: draft },
  };
  const pinned = (
    [
      ['exercise', pins.exercise],
      ['routine', pins.slotId ? pins.routine : null],
    ] as const
  ).filter(([, text]) => !!text);

  return (
    <div className="mx-4 mt-2" data-exercise-note>
      {pinned.length > 0 ? (
        <ul className="mb-1 flex flex-col gap-1.5" aria-label={`Pinned notes for ${exerciseName}`}>
          {pinned.map(([kind, text]) => (
            <li key={kind}>
              <button
                type="button"
                onClick={() => setSheet({ kind })}
                className="pressable flex w-full items-start gap-2 rounded-field bg-lime-dim px-3 py-2 text-left"
                data-pinned-note={kind}
              >
                {kind === 'exercise' ? (
                  <Pin className="mt-0.5 size-3.5 shrink-0 text-lime" aria-hidden />
                ) : (
                  <Bookmark className="mt-0.5 size-3.5 shrink-0 text-lime" aria-hidden />
                )}
                <span className="type-meta min-w-0 flex-1 break-words text-text-1">
                  <span className="font-semibold text-lime">{KIND_LABEL[kind]}: </span>
                  {text}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-start gap-1">
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
        className="-ml-2 block min-w-0 flex-1 resize-none overflow-hidden rounded-field bg-transparent px-2 py-1.5 text-[16px] leading-snug text-text-1 outline-none placeholder:text-text-3 focus:bg-surface-2"
      />
        <button
          type="button"
          aria-label={`Pin a note to ${exerciseName}`}
          onClick={() => {
            save(draft);
            setSheet(
              draft.trim()
                ? { kind: 'exercise', text: draft, from: 'workout' }
                : { kind: 'exercise' },
            );
          }}
          className="pressable -mr-2 flex size-9 shrink-0 items-center justify-center rounded-full text-text-2"
          data-pin-note
        >
          <Pin className="size-4" aria-hidden />
        </button>
      </div>
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
      <PinnedNoteSheet
        open={!!sheet}
        targets={targets}
        startKind={sheet?.kind ?? 'exercise'}
        startText={sheet?.text}
        fromKind={sheet?.from}
        onClose={() => setSheet(null)}
      />
    </div>
  );
});
