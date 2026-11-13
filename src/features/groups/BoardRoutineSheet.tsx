import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Copy, Crown, Lock } from 'lucide-react';
import { CommunityError, type BoardRoutine } from '@/app/community';
import { useFeature } from '@/app/entitlement';
import { BottomSheet, InlineNotice, PrimaryButton, Skeleton } from '@/components/kit';
import { ButtonLink } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { addSharedRoutine } from '@/data/repositories/routineShare';
import { boardRoutineToShared } from './boardRoutine';
import { formatRepRange } from '@/lib/format';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** One person's routine plan from a leaderboard, with a button to copy it. */
export function BoardRoutineSheet({
  open,
  onClose,
  owner,
  load,
}: {
  open: boolean;
  onClose: () => void;
  /** Their name as the board shows it. */
  owner: string;
  load: () => Promise<BoardRoutine | null>;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`${owner}’s routine`}
      subtitle="The plan only: days, exercises, sets and reps"
      tall
    >
      {open ? <Body owner={owner} load={load} onClose={onClose} /> : null}
    </BottomSheet>
  );
}

function Body({
  owner,
  load,
  onClose,
}: {
  owner: string;
  load: () => Promise<BoardRoutine | null>;
  onClose: () => void;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const canCopy = useFeature('copy_routines');
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'none' }
    | { kind: 'error'; message: string }
    | { kind: 'ok'; routine: BoardRoutine }
  >({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    load()
      .then((routine) => {
        if (alive) setState(routine ? { kind: 'ok', routine } : { kind: 'none' });
      })
      .catch((err: unknown) => {
        if (alive)
          setState({
            kind: 'error',
            message: err instanceof CommunityError ? err.message : 'Could not load it. Try again.',
          });
      });
    return () => {
      alive = false;
    };
    // Loaded once each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.kind === 'loading') {
    return (
      <div className="flex flex-col gap-3" aria-busy aria-label="Loading their routine">
        <Skeleton height="5rem" radius="nested" />
        <Skeleton height="10rem" radius="nested" />
      </div>
    );
  }
  if (state.kind === 'error') return <InlineNotice tone="warning">{state.message}</InlineNotice>;
  if (state.kind === 'none') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center" data-routine-private>
        <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-text-2">
          <Lock className="size-5" aria-hidden />
        </span>
        <p className="type-subhead max-w-72 text-text-2">
          {owner} keeps their routine to themselves, or has not made one yet.
        </p>
      </div>
    );
  }

  const r = state.routine;
  const { routine, skipped } = boardRoutineToShared(r, owner);
  const copyable = routine.days.length > 0;

  const copy = async () => {
    setBusy(true);
    try {
      const { routine: added, missing } = await addSharedRoutine(db, routine);
      const left = skipped + missing;
      toast(
        left
          ? `${added.name} added. ${left} of their own exercise${left === 1 ? ' was' : 's were'} left out.`
          : `${added.name} added to your routines`,
      );
      onClose();
      navigate(`/routines/${added.id}`);
    } catch {
      toast('Could not copy it. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-board-routine>
      <p className="type-headline text-text-1">{r.name}</p>
      <ol className="flex flex-col gap-3">
        {r.days.map((d, i) => (
          <li key={i} className="rounded-nested bg-surface-2 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="type-headline text-text-1">{d.name}</span>
              {d.weekdays.length ? (
                <span className="type-caption text-text-2">
                  {d.weekdays.map((w) => WEEKDAYS[w]).join(', ')}
                </span>
              ) : null}
            </div>
            <ul className="mt-2 flex flex-col gap-1.5">
              {d.exercises.map((e, j) => (
                <li key={j} className="type-subhead flex justify-between gap-3">
                  <span className={e.exerciseId ? 'text-text-1' : 'text-text-3 italic'}>
                    {e.name}
                  </span>
                  <span className="tabular shrink-0 text-text-2">
                    {e.sets} × {formatRepRange(e.repMin, e.repMax)}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {copyable && !canCopy ? (
        <div className="flex flex-col gap-2" data-copy-locked>
          <ButtonLink to="/pro" size="lg" block>
            <Crown className="size-4" aria-hidden /> Copy it with Pro
          </ButtonLink>
          <p className="type-caption text-center text-text-2">
            Pro copies any routine on the boards into yours in one tap.
          </p>
        </div>
      ) : copyable ? (
        <PrimaryButton block loading={busy} onClick={() => void copy()} data-copy-routine>
          <Copy className="size-4" aria-hidden /> Copy to my routines
        </PrimaryButton>
      ) : (
        <InlineNotice>It is made of their own exercises, so it cannot be copied.</InlineNotice>
      )}
      <p className="type-caption text-center text-text-2">
        Copies the plan only. You set your own weights as you train.
      </p>
    </div>
  );
}
