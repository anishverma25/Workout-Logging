import { useState } from 'react';
import { REPORT_REASONS, report, type ReportReason, LIMITS, TOPICS, type Topic } from '@/app/forum';
import { BottomSheet, Chip, InlineNotice, PrimaryButton, TextField } from '@/components/kit';
import { cn } from '@/lib/cn';

/** Report a post, reply, photo or member. Works on anonymous content too. */
export function ReportSheet({
  target,
  onClose,
  onSent,
}: {
  target: { kind: 'post' | 'reply' | 'media' | 'member'; id: string | null; username?: string };
  onClose: () => void;
  onSent: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const what =
    target.kind === 'post' ? 'post' : target.kind === 'reply' ? 'reply' : target.kind === 'media' ? 'photo' : 'member';
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={`Report this ${what}`}
      subtitle="Reports are private. The person is not told who reported them."
      footer={
        <PrimaryButton
          block
          disabled={!reason}
          loading={busy}
          onClick={async () => {
            if (!reason) return;
            setBusy(true);
            setError(null);
            try {
              await report(target.kind, target.id, reason, note, target.username);
              onSent();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not send. Try again.');
              setBusy(false);
            }
          }}
          data-send-report
        >
          Send report
        </PrimaryButton>
      }
    >
      <div role="radiogroup" aria-label="Reason" className="flex flex-col gap-2" data-report-sheet>
        {REPORT_REASONS.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={reason === r.id}
            onClick={() => setReason(r.id)}
            className={cn(
              'pressable flex flex-col rounded-nested bg-surface-2 px-4 py-3 text-left',
              reason === r.id && 'ring-2 ring-lime ring-inset',
            )}
            data-reason={r.id}
          >
            <span className="type-headline text-text-1">{r.label}</span>
            <span className="type-meta text-text-2">{r.hint}</span>
          </button>
        ))}
        {reason === 'self_harm' ? (
          <InlineNotice tone="info">
            If someone is in danger now, call 112. Tele-MANAS (14416) is free, any time, in many
            languages.
          </InlineNotice>
        ) : null}
        <TextField
          label="Note (optional)"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything that helps us check it"
          className="mt-2"
        />
        {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}
      </div>
    </BottomSheet>
  );
}

/** Edit a post's title, text and topic, or a reply's text. */
export function EditSheet({
  initial,
  kind,
  onClose,
  onSave,
}: {
  initial: { title?: string; body: string; topic?: Topic; postKind?: 'question' | 'journey' };
  kind: 'post' | 'reply';
  onClose: () => void;
  onSave: (v: { title: string; body: string; topic: Topic }) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [body, setBody] = useState(initial.body);
  const [topic, setTopic] = useState<Topic>(initial.topic ?? 'training');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = kind === 'reply' ? LIMITS.reply : initial.postKind === 'journey' ? LIMITS.journey : LIMITS.question;
  const ok = kind === 'reply' ? body.trim().length > 0 : title.trim().length >= 3;
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={kind === 'post' ? 'Edit post' : 'Edit reply'}
      subtitle="Edited posts show that they were edited."
      tall
      footer={
        <PrimaryButton
          block
          disabled={!ok}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onSave({ title: title.trim(), body: body.trim(), topic });
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not save. Try again.');
              setBusy(false);
            }
          }}
          data-save-edit
        >
          Save
        </PrimaryButton>
      }
    >
      <div className="flex flex-col gap-4">
        {kind === 'post' ? (
          <>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <Chip key={t.id} selected={topic === t.id} onClick={() => setTopic(t.id)}>
                  {t.short}
                </Chip>
              ))}
            </div>
            <TextField label="Title" value={title} maxLength={LIMITS.title} onChange={(e) => setTitle(e.target.value)} />
          </>
        ) : null}
        <div>
          <label htmlFor="edit-body" className="type-meta mb-1.5 block text-text-2">
            Text
          </label>
          <textarea
            id="edit-body"
            value={body}
            maxLength={max}
            rows={7}
            style={{ fieldSizing: 'content' } as React.CSSProperties}
            onChange={(e) => setBody(e.target.value)}
            className="block min-h-40 w-full resize-none rounded-field border border-transparent bg-surface-2 px-3.5 py-3 text-[1rem] leading-[1.45] text-text-1 outline-none focus:border-text-2"
          />
        </div>
        {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}
      </div>
    </BottomSheet>
  );
}
