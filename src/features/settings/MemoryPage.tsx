import { useState } from 'react';
import { CalendarDays, HeartPulse, Pencil, StickyNote, Trash2 } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { PrimaryButton, SecondaryButton } from '@/components/kit';
import { Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { addMemory, editMemory, MEMORY_MAX_CHARS, PlanError, removePlanItem } from '@/data/repositories/plan';
import { toDateKey } from '@/lib/dates';
import { useNow } from '@/lib/useNow';
import { usePlanItems } from '../brain/useBrain';
import { knownFacts, type KnownFact } from '../coach/memory';

const ICON = { note: StickyNote, event: CalendarDays, pain: HeartPulse } as const;
const SOURCE = { note: 'You told it', event: 'From Coming up', pain: 'From Something hurts' } as const;
const fieldClass =
  'min-h-12 w-full rounded-field bg-surface-2 px-3 py-3 text-[16px] text-text-1 placeholder:text-text-3';

/**
 * "What Macrotrophy AI knows": everything it is told about the person beyond their numbers,
 * each item theirs to edit or delete. Nothing here is hidden from them.
 */
export function MemoryPage() {
  const items = usePlanItems();
  const now = useNow();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const facts = items.status === 'success' ? knownFacts(items.data, toDateKey(now)) : [];

  const add = async () => {
    try {
      await addMemory(db, draft);
      setDraft('');
      setError(null);
    } catch (e) {
      setError(e instanceof PlanError ? e.message : 'Could not save. Try again.');
    }
  };
  const remove = async (f: KnownFact) => {
    await removePlanItem(db, f.id);
    toast('Forgotten');
  };
  const save = async () => {
    if (!editing) return;
    try {
      await editMemory(db, editing.id, editing.text);
      setEditing(null);
      setError(null);
    } catch (e) {
      setError(e instanceof PlanError ? e.message : 'Could not save. Try again.');
    }
  };

  return (
    <>
      <PageHeader
        back={{ to: '/settings', label: 'Settings' }}
        title="What Macrotrophy AI knows"
        subtitle="Yours to edit or delete"
      />
      <div className="flex max-w-2xl flex-col gap-5" data-memory-page>
        <p className="type-subhead text-text-2">
          Besides your logged numbers, Macrotrophy AI is told these things when you ask it something, so you never
          have to repeat yourself. They are kept with your own data and sent only with your question, never with
          your name or email. Your goal, diet and schedule come from your profile.
        </p>

        <section className="flex flex-col gap-2 rounded-panel bg-surface p-5">
          <label htmlFor="memory-new" className="type-headline text-text-1">
            Tell it something
          </label>
          <textarea
            id="memory-new"
            rows={2}
            maxLength={MEMORY_MAX_CHARS}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Like: I train at 6 am before class. My left knee was operated on in 2024."
            className={fieldClass}
          />
          {error && !editing ? (
            <p role="alert" className="type-footnote text-danger-text">
              {error}
            </p>
          ) : null}
          <PrimaryButton compact disabled={!draft.trim()} onClick={() => void add()} data-memory-add>
            Remember this
          </PrimaryButton>
        </section>

        {items.status === 'loading' ? <Skeleton className="h-40 rounded-panel" /> : null}
        {items.status === 'success' && facts.length === 0 ? (
          <p className="type-subhead px-1 text-text-3">Nothing yet beyond your profile and your logs.</p>
        ) : null}
        {facts.length ? (
          <ul className="flex flex-col divide-y-[0.5px] divide-divider rounded-panel bg-surface px-5" data-memory-list>
            {facts.map((f) => {
              const Icon = ICON[f.kind];
              const isEditing = editing?.id === f.id;
              return (
                <li key={f.id} className="flex items-start gap-3 py-4" data-memory-item={f.kind}>
                  <Icon className="mt-0.5 size-5 shrink-0 text-text-2" aria-hidden />
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          rows={2}
                          maxLength={MEMORY_MAX_CHARS}
                          value={editing.text}
                          aria-label="Edit what it remembers"
                          onChange={(e) => setEditing({ id: f.id, text: e.target.value })}
                          className={fieldClass}
                        />
                        {error ? (
                          <p role="alert" className="type-footnote text-danger-text">
                            {error}
                          </p>
                        ) : null}
                        <div className="flex gap-2">
                          <PrimaryButton compact onClick={() => void save()}>
                            Save
                          </PrimaryButton>
                          <SecondaryButton compact onClick={() => setEditing(null)}>
                            Cancel
                          </SecondaryButton>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="type-body text-text-1">{f.text}</p>
                        <p className="type-footnote text-text-3">{SOURCE[f.kind]}</p>
                      </>
                    )}
                  </div>
                  {!isEditing ? (
                    <div className="flex shrink-0">
                      {f.kind === 'note' ? (
                        <button
                          type="button"
                          className="pressable tap-target flex size-10 items-center justify-center rounded-full text-text-2"
                          aria-label={`Edit: ${f.text}`}
                          onClick={() => {
                            setError(null);
                            setEditing({ id: f.id, text: f.text });
                          }}
                        >
                          <Pencil className="size-[18px]" aria-hidden />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="pressable tap-target flex size-10 items-center justify-center rounded-full text-text-2"
                        aria-label={`Delete: ${f.text}`}
                        onClick={() => void remove(f)}
                      >
                        <Trash2 className="size-[18px]" aria-hidden />
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </>
  );
}
