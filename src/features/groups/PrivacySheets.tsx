import { useState } from 'react';
import { BottomSheet, PrimaryButton, TextField } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import {
  CommunityError,
  reportContent,
  setLeaderboardStyle,
  type NameStyle,
  type ReportReason,
} from '@/app/community';
import { cn } from '@/lib/cn';

const STYLES: { value: NameStyle; title: string; detail: string }[] = [
  { value: 'name', title: 'My name', detail: 'Your profile name and photo.' },
  { value: 'username', title: 'My username', detail: 'Your username and photo, not your name.' },
  { value: 'initials', title: 'Initials only', detail: 'Like "A. V.", with no photo.' },
  {
    value: 'hidden',
    title: 'Not at all',
    detail: 'You are left off the public board. You still see your own place.',
  },
];

function Choice<T extends string>({
  options,
  value,
  onChange,
  name,
}: {
  options: { value: T; title: string; detail?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-col gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'pressable rounded-card px-4 py-3 text-left',
            value === o.value ? 'bg-lime-dim ring-2 ring-lime' : 'bg-surface-2',
          )}
          data-choice={o.value}
        >
          <span className="type-headline block text-text-1">{o.title}</span>
          {o.detail ? <span className="type-subhead block text-text-2">{o.detail}</span> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * "Show me on the public leaderboard as": asked once, and changed any time from the global
 * board. The choice applies to the public board only; groups always show usernames to members.
 */
export function ShowAsSheet({
  open,
  current,
  first,
  hasUsername,
  onClose,
  onSaved,
}: {
  open: boolean;
  current: NameStyle;
  first: boolean;
  hasUsername: boolean;
  onClose: () => void;
  onSaved: (style: NameStyle) => void;
}) {
  return open ? (
    <ShowAsForm
      current={current}
      first={first}
      hasUsername={hasUsername}
      onClose={onClose}
      onSaved={onSaved}
    />
  ) : null;
}

function ShowAsForm({
  current,
  first,
  hasUsername,
  onClose,
  onSaved,
}: {
  current: NameStyle;
  first: boolean;
  hasUsername: boolean;
  onClose: () => void;
  onSaved: (style: NameStyle) => void;
}) {
  const toast = useToast();
  const [style, setStyle] = useState<NameStyle>(current);
  const [busy, setBusy] = useState(false);
  const options = STYLES.filter((s) => s.value !== 'username' || hasUsername);
  const save = async () => {
    setBusy(true);
    try {
      await setLeaderboardStyle(style);
      onSaved(style);
      toast(style === 'hidden' ? 'You are off the public board' : 'Saved');
    } catch (err) {
      toast(err instanceof CommunityError ? err.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={first ? 'How should you appear?' : 'Show me as'}
      subtitle="On the public leaderboard, which everyone on Macrotrophy can see."
      footer={
        <PrimaryButton block loading={busy} onClick={() => void save()} data-show-as-save>
          Save
        </PrimaryButton>
      }
    >
      <div data-show-as>
        <Choice name="Show me as" options={options} value={style} onChange={setStyle} />
      </div>
    </BottomSheet>
  );
}

const REASONS: { value: ReportReason; title: string }[] = [
  { value: 'name', title: 'Rude or offensive name' },
  { value: 'photo', title: 'Inappropriate photo' },
  { value: 'cheating', title: 'Fake or impossible workouts' },
  { value: 'harassment', title: 'Harassment or bullying' },
  { value: 'other', title: 'Something else' },
];

/** Reports a person or a group to the Macrotrophy team. */
export function ReportSheet({
  open,
  kind,
  target,
  label,
  onClose,
}: {
  open: boolean;
  kind: 'person' | 'group';
  /** What the team needs to find it: a username, or a group id. */
  target: string;
  /** What the person sees: their name, or the group's name. */
  label: string;
  onClose: () => void;
}) {
  return open ? <ReportForm kind={kind} target={target} label={label} onClose={onClose} /> : null;
}

function ReportForm({
  kind,
  target,
  label,
  onClose,
}: {
  kind: 'person' | 'group';
  target: string;
  label: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await reportContent(kind, target, reason, note);
      toast('Thanks. The team will look at it.');
      onClose();
    } catch (err) {
      toast(err instanceof CommunityError ? err.message : 'Could not send. Try again.');
      setBusy(false);
    }
  };
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={`Report ${label}`}
      subtitle="Reports go to the Macrotrophy team only. Nobody else is told who sent them."
      footer={
        <PrimaryButton
          block
          loading={busy}
          disabled={!reason}
          onClick={() => void send()}
          data-report-send
        >
          Send report
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4" data-report-sheet>
        <Choice name="Reason" options={REASONS} value={reason} onChange={setReason} />
        <TextField
          label="Anything else (optional)"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
    </BottomSheet>
  );
}
