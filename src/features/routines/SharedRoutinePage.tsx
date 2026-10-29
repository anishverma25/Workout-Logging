import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CalendarRange, Link2Off } from 'lucide-react';
import { useAccount } from '@/app/account';
import { BrandMark } from '@/app/layout/BrandMark';
import { APP_NAME } from '@/app/navigation';
import { Card, InlineNotice, PrimaryButton, SecondaryButton, Skeleton } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { SYSTEM_EXERCISE_KEYS, SYSTEM_EXERCISES } from '@/data/library/exercises';
import { addSharedRoutine } from '@/data/repositories/routineShare';
import { decodeRoutine, SHARE_PATH, type SharedExercise } from '@/domain/routines/share';
import { formatRepRange } from '@/lib/format';

/** Kept while someone signs up or in to add a routine sent to them. */
const PENDING_KEY = 'overload.sharedRoutine';

const NAME_BY_KEY = new Map(SYSTEM_EXERCISES.map((e, i) => [SYSTEM_EXERCISE_KEYS[i]!, e.name]));
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function readCode(): string {
  const fromLink = window.location.hash.replace(/^#/, '');
  try {
    if (fromLink) {
      localStorage.setItem(PENDING_KEY, fromLink);
      return fromLink;
    }
    return localStorage.getItem(PENDING_KEY) ?? '';
  } catch {
    return fromLink;
  }
}

function forget() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing to forget.
  }
}

const exerciseName = (e: SharedExercise) =>
  e.key ? (NAME_BY_KEY.get(e.key) ?? null) : (e.custom?.name ?? null);

/**
 * A routine someone sent as a link: what is in it, and one tap to add it. Readable without an
 * account; adding needs one, and the routine waits on this phone through signing up.
 */
export function SharedRoutinePage() {
  const account = useAccount();
  const navigate = useNavigate();
  const toast = useToast();
  const [code] = useState(readCode);
  const routine = useMemo(() => decodeRoutine(code), [code]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = routine ? `${routine.name} | ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = APP_NAME;
    };
  }, [routine]);

  async function add() {
    if (!routine) return;
    setBusy(true);
    setError(null);
    try {
      const { routine: added, missing } = await addSharedRoutine(db, routine);
      forget();
      toast(
        missing
          ? `${added.name} added. ${missing} exercise${missing === 1 ? ' needs' : 's need'} the latest version of the app and was left out.`
          : `${added.name} added to your routines`,
      );
      navigate(`/routines/${added.id}`, { replace: true });
    } catch {
      setError('The routine could not be added. Try again.');
      setBusy(false);
    }
  }

  const signedIn = account.status === 'signedIn' || account.status === 'unavailable';
  const next = encodeURIComponent(SHARE_PATH);

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 pt-safe pb-2">
        <Link to="/" className="chrome tap-target flex items-center gap-2 rounded-field">
          <BrandMark className="size-8" />
          <span className="type-headline text-text-1">{APP_NAME}</span>
        </Link>
      </header>
      <main id="main" className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pt-6 pb-12">
        {!routine ? (
          <Card className="p-5" data-shared-routine-bad>
            <Link2Off className="size-6 text-text-2" aria-hidden />
            <h1 className="type-title mt-3 text-text-1">This link does not open a routine</h1>
            <p className="type-body mt-2 text-text-2">
              It may have been cut short when it was sent. Ask for the link again, and send it as a
              link rather than as part of a long message.
            </p>
            <SecondaryButton className="mt-4" onClick={() => navigate('/routines')}>
              Go to my routines
            </SecondaryButton>
          </Card>
        ) : (
          <>
            <div>
              <p className="type-meta font-semibold text-text-2">A routine sent to you</p>
              <h1 className="type-display mt-1 [overflow-wrap:anywhere] text-text-1">
                {routine.name}
              </h1>
              <p className="type-meta mt-1 text-text-2">
                {routine.days.length} {routine.days.length === 1 ? 'day' : 'days'} ·{' '}
                {routine.days.reduce((t, d) => t + d.exercises.length, 0)} exercises
              </p>
            </div>

            <ol className="flex flex-col gap-3" data-shared-days>
              {routine.days.map((day, i) => (
                <li key={i}>
                  <Card className="p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="type-headline [overflow-wrap:anywhere] text-text-1">
                        {day.name}
                      </h2>
                      {day.weekdays.length ? (
                        <span className="type-caption shrink-0 text-text-2">
                          {day.weekdays.map((w) => WEEKDAYS[w]).join(', ')}
                        </span>
                      ) : null}
                    </div>
                    {day.exercises.length ? (
                      <ul className="mt-2 flex flex-col gap-1">
                        {day.exercises.map((e, j) => (
                          <li key={j} className="flex items-baseline justify-between gap-3">
                            <span className="type-body min-w-0 [overflow-wrap:anywhere] text-text-1">
                              {exerciseName(e) ?? 'An exercise from a newer version'}
                            </span>
                            <span className="type-meta tabular shrink-0 text-text-2">
                              {e.sets} × {formatRepRange(e.repMin, e.repMax)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="type-meta mt-2 text-text-2">No exercises yet</p>
                    )}
                  </Card>
                </li>
              ))}
            </ol>

            {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}

            {account.status === 'loading' ? (
              <Skeleton height={52} radius="panel" />
            ) : signedIn ? (
              <PrimaryButton
                block
                icon={<CalendarRange className="size-5" aria-hidden />}
                onClick={() => void add()}
                disabled={busy}
                data-add-shared-routine
              >
                {busy ? 'Adding…' : 'Add to my routines'}
              </PrimaryButton>
            ) : (
              <div className="flex flex-col gap-2">
                <PrimaryButton block onClick={() => navigate(`/sign-up?next=${next}`)}>
                  Create a free account to add it
                </PrimaryButton>
                <SecondaryButton block onClick={() => navigate(`/sign-in?next=${next}`)}>
                  I have an account
                </SecondaryButton>
              </div>
            )}
            <p className="type-caption text-text-2">
              Added as a new routine you can change any way you like. Nothing of yours is replaced.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
