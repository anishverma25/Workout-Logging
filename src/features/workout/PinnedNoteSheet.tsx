import { useState } from 'react';
import { BottomSheet, PrimaryButton, SegmentedControl, TextButton } from '@/components/kit';
import { TextArea } from '@/components/ui/Fields';
import { useToast } from '@/components/ui/Toast';
import { PINNED_NOTE_MAX, type NoteKind } from '@/data/repositories/exerciseNotes';
import { KIND_HINT, KIND_LABEL, saveNote, type NoteTargets } from './noteKinds';

/**
 * Writes or moves a note between its three kinds: pinned to the exercise, pinned to the
 * routine, or for today only. Moving a note clears it where it was.
 */
export function PinnedNoteSheet(props: {
  open: boolean;
  targets: NoteTargets;
  startKind: NoteKind;
  /** Text to start with (today's draft being pinned); else the kind's own note. */
  startText?: string;
  /** Where the text comes from, when it is not `startKind` (today's draft being pinned). */
  fromKind?: NoteKind;
  onClose: () => void;
}) {
  return props.open ? <Form {...props} /> : null;
}

function Form({
  targets: t,
  startKind,
  startText,
  fromKind,
  onClose,
}: {
  targets: NoteTargets;
  startKind: NoteKind;
  startText?: string;
  fromKind?: NoteKind;
  onClose: () => void;
}) {
  const toast = useToast();
  const kinds: NoteKind[] = t.slotId
    ? ['exercise', 'routine', 'workout']
    : ['exercise', 'workout'];
  const [kind, setKind] = useState<NoteKind>(startKind);
  const [text, setText] = useState(startText ?? t.current[startKind]);
  const from = fromKind ?? startKind;
  const moved = kind !== from;

  async function save() {
    await saveNote(t, kind, text);
    // Moving a note (or pinning today's draft) clears it where it came from.
    if (moved && t.current[from].trim()) await saveNote(t, from, '');
    toast(
      !text.trim()
        ? 'Note removed'
        : kind === 'workout'
          ? 'Note saved for today'
          : `Pinned: ${KIND_LABEL[kind].toLowerCase()}`,
    );
    onClose();
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={`Note for ${t.exerciseName}`}
      footer={
        <div className="flex items-center justify-between gap-2">
          {t.current[from].trim() && !moved ? (
            <TextButton
              onClick={async () => {
                await saveNote(t, from, '');
                toast('Note removed');
                onClose();
              }}
            >
              Remove
            </TextButton>
          ) : (
            <span />
          )}
          <PrimaryButton onClick={() => void save()} data-save-note>
            Save note
          </PrimaryButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-1" data-note-sheet>
        <SegmentedControl<NoteKind>
          label="Where this note shows"
          block
          value={kind}
          options={kinds.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          onChange={setKind}
        />
        <p className="type-meta text-text-2">{KIND_HINT(t)[kind]}</p>
        <TextArea
          label="Note"
          value={text}
          maxLength={PINNED_NOTE_MAX}
          placeholder="Seat height, grip, cues"
          onChange={(e) => setText(e.target.value)}
          className="[&_textarea]:text-[16px]"
        />
      </div>
    </BottomSheet>
  );
}
