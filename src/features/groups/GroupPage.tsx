import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  ChevronDown,
  Copy,
  Crown,
  Ellipsis,
  KeyRound,
  LogOut,
  Pencil,
  Share2,
  Trophy,
  UserMinus,
} from 'lucide-react';
import { useSyncStatus } from '@/app/account';
import { useFeature } from '@/app/entitlement';
import {
  CommunityError,
  formatCode,
  getAvatars,
  getBoard,
  getWinners,
  leaveGroup,
  newGroupCode,
  removeMember,
  renameGroup,
  scoreParts,
  useRemote,
  type BoardRow,
  type Period,
  type Winner,
} from '@/app/community';
import { PageHeader } from '@/app/layout/PageHeader';
import {
  ActionMenu,
  BottomSheet,
  ChipGroup,
  ConfirmSheet,
  IconButton,
  InlineNotice,
  PrimaryButton,
  SecondaryButton,
  Section,
  SegmentedControl,
  Skeleton,
  TextButton,
  TextField,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import { HowPointsWork } from './GroupsPage';
import { MemberAvatar } from './parts';
import { shareCode } from './shareCode';
import { rankCard } from '@/domain/share/rankCard';
import { RankShareSheet } from '@/features/share/RankShareSheet';

/** The boards a group can switch to. Overload Score is free; the others are Pro. */
type BoardKind = 'score' | 'consistency' | 'effort' | 'progress' | 'volume';

const BOARDS: { value: BoardKind; label: string }[] = [
  { value: 'score', label: 'Overload Score' },
  { value: 'consistency', label: 'Consistency' },
  { value: 'effort', label: 'Effort' },
  { value: 'progress', label: 'Progress' },
  { value: 'volume', label: 'Volume' },
];

const BOARD_ABOUT: Record<BoardKind, string> = {
  score: 'Workouts, hard sets, records and protein days, with weekly caps so it stays fair.',
  consistency: 'Days trained, then workouts. Showing up, nothing else.',
  effort: 'Hard sets: working sets close to failure.',
  progress:
    'Average change in your best estimated 1RM on each exercise, against your own last 4 weeks.',
  volume: 'Total kilograms lifted. Favours heavier lifters, so it is never the default.',
};

/** The value shown on the right of each row, and the order, for each board. */
function sortedFor(kind: BoardKind, rows: BoardRow[]): BoardRow[] {
  if (kind === 'score') return rows;
  const key = (r: BoardRow): number[] =>
    kind === 'consistency'
      ? [r.activeDays ?? 0, r.workouts]
      : kind === 'effort'
        ? [r.hardSets, r.workouts]
        : kind === 'progress'
          ? [r.progressPct ?? -Infinity, r.records]
          : [r.volumeKg ?? 0, r.hardSets];
  return [...rows].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (kb[i]! !== ka[i]!) return kb[i]! - ka[i]!;
    return a.username.localeCompare(b.username);
  });
}

function valueFor(kind: BoardKind, r: BoardRow): { main: string; unit: string } {
  switch (kind) {
    case 'score':
      return { main: formatNumber(r.score), unit: r.score === 1 ? 'point' : 'points' };
    case 'consistency':
      return { main: String(r.activeDays ?? 0), unit: r.activeDays === 1 ? 'day' : 'days' };
    case 'effort':
      return { main: String(r.hardSets), unit: r.hardSets === 1 ? 'hard set' : 'hard sets' };
    case 'progress':
      return r.progressPct === null
        ? { main: '–', unit: 'no comparison' }
        : { main: `${r.progressPct > 0 ? '+' : ''}${r.progressPct}%`, unit: 'stronger' };
    case 'volume':
      return { main: formatNumber(r.volumeKg ?? 0), unit: 'kg' };
  }
}

const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const MEDAL = [
  'bg-gold-dim text-gold',
  'bg-[var(--fill)] text-[var(--tier-silver-1)]',
  'bg-[var(--fill)] text-[var(--tier-bronze-1)]',
];

/**
 * One group (November 2026): its leaderboard for this or last week or month, the invite code,
 * who trained today, past winners, and admin controls.
 */
export function GroupPage() {
  const { groupId = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [period, setPeriod] = useState<Period>('week');
  const [offset, setOffset] = useState<0 | -1>(0);
  const [kind, setKind] = useState<BoardKind>('score');
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<'rename' | 'members' | 'code' | 'leave' | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sync = useSyncStatus();
  const proBoards = useFeature('group_boards');

  const board = useRemote(
    () => getBoard(groupId, period, offset),
    `${groupId}:${period}:${offset}:${version}`,
  );
  const winners = useRemote(() => getWinners(groupId), `${groupId}:w:${version}`);
  const b = board.data ?? null;
  const shownRows = b ? sortedFor(proBoards ? kind : 'score', b.rows) : [];
  const me = b?.rows.find((r) => r.me) ?? null;
  const [sharing, setSharing] = useState(false);
  // The story card is for the Overload Score board only.
  const shareCard =
    b && (!proBoards || kind === 'score')
      ? rankCard({
          scope: 'group',
          where: b.group.name,
          period: b.period,
          locked: b.locked,
          startsOn: b.startsOn,
          endsOn: b.endsOn,
          total: b.rows.length,
          rows: b.rows,
        })
      : null;
  const wanted = b
    ? Array.from(
        new Set([...b.rows.slice(0, 3).map((r) => r.username), me?.username ?? '']),
      ).filter(Boolean)
    : [];
  const avatars = useRemote(
    wanted.length ? () => getAvatars(groupId, wanted) : null,
    `${groupId}:a:${wanted.join(',')}`,
  );
  const photo = (u: string) => avatars.data?.[u] ?? null;

  const isNew = params.get('new') === '1';
  const unsynced = sync.pending - sync.rejected;

  const share = async () => {
    if (!b) return;
    const result = await shareCode(b.group.name, b.group.code);
    if (result === 'copied') toast(`Code ${formatCode(b.group.code)} copied`);
    if (result === 'failed') toast(`The code is ${formatCode(b.group.code)}`);
  };
  const copy = async () => {
    if (!b) return;
    try {
      await navigator.clipboard.writeText(formatCode(b.group.code));
      toast(`Code ${formatCode(b.group.code)} copied`);
    } catch {
      toast(`The code is ${formatCode(b.group.code)}`);
    }
  };

  const periodName = period === 'week' ? 'week' : 'month';
  const which = offset === 0 ? `This ${periodName}` : `Last ${periodName}`;

  return (
    <>
      <PageHeader
        back={{ to: '/groups', label: 'Groups' }}
        title={b?.group.name ?? 'Group'}
        subtitle={
          b
            ? `${b.group.members} ${b.group.members === 1 ? 'member' : 'members'}${b.group.role === 'admin' ? ' · You are the admin' : ''}`
            : undefined
        }
        actions={
          b ? (
            <IconButton
              label="Group options"
              icon={<Ellipsis className="size-5" aria-hidden />}
              ref={menuButton}
              aria-expanded={menu}
              aria-haspopup="menu"
              onClick={() => setMenu((m) => !m)}
              data-group-menu
            />
          ) : null
        }
      />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-10" data-group-page>
        {board.loading && !b ? <Skeleton height="16rem" radius="panel" /> : null}
        {board.error ? (
          <InlineNotice tone="warning">
            {board.error}{' '}
            {/not in this group/i.test(board.error) ? (
              <Link to="/groups" className="font-semibold underline">
                Back to groups
              </Link>
            ) : (
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => setVersion((v) => v + 1)}
              >
                Try again
              </button>
            )}
          </InlineNotice>
        ) : null}

        {b ? (
          <>
            <section
              className={cn(
                'rounded-panel px-5 py-4',
                isNew || b.group.members === 1 ? 'bg-lime-dim' : 'bg-surface',
              )}
              aria-labelledby="invite-title"
              data-invite
            >
              <h2 id="invite-title" className="type-headline text-text-1">
                {isNew ? 'Your group is ready. Invite your friends' : 'Invite friends'}
              </h2>
              <p className="type-subhead mt-0.5 text-text-2">
                They open Overload, go to Groups, tap Join with a code and type:
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span
                  className="type-title-1 tabular font-display tracking-[0.15em] text-text-1"
                  data-group-code={b.group.code}
                >
                  {formatCode(b.group.code)}
                </span>
                <span className="ml-auto flex gap-2">
                  <IconButton
                    label="Copy code"
                    icon={<Copy className="size-5" aria-hidden />}
                    onClick={() => void copy()}
                  />
                  <PrimaryButton
                    compact
                    icon={<Share2 className="size-4" aria-hidden />}
                    onClick={() => void share()}
                    data-share-code
                  >
                    Share code
                  </PrimaryButton>
                </span>
              </div>
            </section>

            {unsynced > 0 ? (
              <InlineNotice>
                Some of your changes have not reached your account yet. Your workouts count here
                once they sync.
              </InlineNotice>
            ) : null}

            <div className="flex flex-col gap-3">
              <SegmentedControl<Period>
                label="Leaderboard period"
                block
                value={period}
                onChange={(p) => {
                  setPeriod(p);
                  setOffset(0);
                }}
                options={[
                  { value: 'week', label: 'Weekly' },
                  { value: 'month', label: 'Monthly' },
                ]}
              />
              {proBoards ? (
                <ChipGroup<BoardKind>
                  label="Leaderboard"
                  scroll
                  value={kind}
                  onChange={setKind}
                  options={BOARDS}
                />
              ) : (
                <Link
                  to="/pro"
                  className="type-subhead flex items-center gap-1.5 text-text-2"
                  data-more-boards-pro
                >
                  <Crown className="size-4 text-lime" aria-hidden />
                  Consistency, Effort, Progress and Volume boards come with Pro
                </Link>
              )}
            </div>

            {shareCard ? (
              <SecondaryButton
                block
                icon={<Share2 className="size-4" aria-hidden />}
                onClick={() => setSharing(true)}
                data-share-rank
              >
                Share my place
              </SecondaryButton>
            ) : null}

            <Section
              title={`${which} · ${dateLabel(b.startsOn)} to ${dateLabel(b.endsOn)}`}
              id="board-title"
              action={
                <TextButton
                  small
                  onClick={() => setOffset((o) => (o === 0 ? -1 : 0))}
                  data-toggle-offset
                >
                  {offset === 0 ? `Last ${periodName}` : `This ${periodName}`}
                </TextButton>
              }
              footer={
                offset === 0
                  ? `${BOARD_ABOUT[proBoards ? kind : 'score']} Tap a name to see how the points add up.`
                  : 'Final result, locked when it ended.'
              }
            >
              {offset === 0 ? (
                <p className="type-subhead tabular mb-3 text-text-2" data-trained-today>
                  <span className="font-semibold text-text-1">
                    {b.trainedToday.length} of {b.group.members}
                  </span>{' '}
                  trained today
                  {b.trainedToday.length > 0
                    ? `: ${b.trainedToday
                        .slice(0, 4)
                        .map((u) => `@${u}`)
                        .join(
                          ', ',
                        )}${b.trainedToday.length > 4 ? ` and ${b.trainedToday.length - 4} more` : ''}`
                    : '. Be the first.'}
                </p>
              ) : null}

              {!b.available ? (
                <p className="type-meta rounded-card bg-surface p-4 text-text-2">
                  The group did not exist yet in that {periodName}.
                </p>
              ) : (
                <ol
                  className="divide-y-[0.5px] divide-divider overflow-hidden rounded-card bg-surface"
                  aria-labelledby="board-title"
                  data-board={proBoards ? kind : 'score'}
                >
                  {shownRows.map((r, i) => (
                    <BoardRowView
                      key={r.username}
                      row={r}
                      place={(proBoards ? kind : 'score') === 'score' ? r.rank : i + 1}
                      kind={proBoards ? kind : 'score'}
                      photo={photo(r.username)}
                      open={open === r.username}
                      onToggle={() => setOpen((o) => (o === r.username ? null : r.username))}
                    />
                  ))}
                </ol>
              )}

              {b.available && b.rows.every((r) => r.score === 0) && offset === 0 ? (
                <p className="type-meta mt-3 text-text-2">
                  No points yet this {periodName}. The first finished workout takes the lead.
                </p>
              ) : null}
            </Section>

            <PastWinners winners={winners.data ?? []} />
            <HowPointsWork />
          </>
        ) : null}
      </div>

      {b ? (
        <>
          <ActionMenu
            open={menu}
            onClose={() => setMenu(false)}
            anchor={menuButton}
            label={`Options for ${b.group.name}`}
            items={[
              {
                label: 'Share code',
                icon: <Share2 className="size-5" aria-hidden />,
                onSelect: () => {
                  setMenu(false);
                  void share();
                },
              },
              ...(b.group.role === 'admin'
                ? [
                    {
                      label: 'Rename group',
                      icon: <Pencil className="size-5" aria-hidden />,
                      onSelect: () => {
                        setMenu(false);
                        setSheet('rename');
                      },
                    },
                    {
                      label: 'Make a new code',
                      icon: <KeyRound className="size-5" aria-hidden />,
                      onSelect: () => {
                        setMenu(false);
                        setSheet('code');
                      },
                    },
                    {
                      label: 'Remove someone',
                      icon: <UserMinus className="size-5" aria-hidden />,
                      disabled: b.group.members < 2,
                      hint: 'No one else is in the group yet',
                      onSelect: () => {
                        setMenu(false);
                        setSheet('members');
                      },
                    },
                  ]
                : []),
              {
                label: 'Leave group',
                icon: <LogOut className="size-5" aria-hidden />,
                danger: true,
                onSelect: () => {
                  setMenu(false);
                  setSheet('leave');
                },
              },
            ]}
          />
          <BottomSheet
            open={sheet === 'rename'}
            onClose={() => setSheet(null)}
            title="Rename group"
          >
            {sheet === 'rename' ? (
              <RenameForm
                groupId={b.group.id}
                initial={b.group.name}
                onDone={() => {
                  setSheet(null);
                  setVersion((v) => v + 1);
                }}
              />
            ) : null}
          </BottomSheet>
          <BottomSheet
            open={sheet === 'members'}
            onClose={() => setSheet(null)}
            title="Remove someone"
          >
            {sheet === 'members' ? (
              <RemoveList
                groupId={b.group.id}
                usernames={b.rows.filter((r) => !r.me).map((r) => r.username)}
                onRemoved={(u) => {
                  toast(`@${u} was removed`);
                  setVersion((v) => v + 1);
                }}
              />
            ) : null}
          </BottomSheet>
          <CodeConfirm
            open={sheet === 'code'}
            groupId={b.group.id}
            onClose={() => setSheet(null)}
            onDone={(code) => {
              setSheet(null);
              toast(`New code: ${formatCode(code)}`);
              setVersion((v) => v + 1);
            }}
          />
          <LeaveConfirm
            open={sheet === 'leave'}
            groupId={b.group.id}
            name={b.group.name}
            alone={b.group.members === 1}
            onClose={() => setSheet(null)}
            onLeft={() => {
              toast(`You left ${b.group.name}`);
              navigate('/groups', { replace: true });
            }}
          />
          <RankShareSheet card={shareCard} open={sharing} onClose={() => setSharing(false)} />
        </>
      ) : null}
    </>
  );
}

function BoardRowView({
  row: r,
  place,
  kind,
  photo,
  open,
  onToggle,
}: {
  row: BoardRow;
  place: number;
  kind: BoardKind;
  photo: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  const v = valueFor(kind, r);
  return (
    <li
      className={cn(r.me && 'bg-lime-dim')}
      data-board-row={r.username}
      data-me={r.me || undefined}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="pressable flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={cn(
            'type-headline tabular flex size-8 shrink-0 items-center justify-center rounded-full',
            MEDAL[place - 1] ?? 'text-text-2',
          )}
          aria-label={`Place ${place}`}
        >
          {place}
        </span>
        <MemberAvatar username={r.username} avatar={photo} />
        <span className="min-w-0 flex-1">
          <span className="type-headline block truncate text-text-1">
            @{r.username}
            {r.me ? <span className="type-subhead ml-1.5 text-text-2">You</span> : null}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="type-headline tabular block text-text-1">{v.main}</span>
          <span className="type-caption block text-text-2">{v.unit}</span>
        </span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-text-3 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="px-4 pb-4" data-breakdown>
          <ul className="grid grid-cols-2 gap-2">
            {scoreParts(r).map((p) => (
              <li key={p.key} className="rounded-nested bg-surface-2 px-3 py-2">
                <span className="type-caption block text-text-2">{p.label}</span>
                <span className="type-headline tabular block text-text-1">
                  {p.count} <span className="type-caption text-text-2">= {p.points} pts</span>
                </span>
              </li>
            ))}
          </ul>
          {r.me && !r.hasProteinTarget ? (
            <p className="type-meta mt-2 text-text-2">
              Set a protein target on{' '}
              <Link to="/body" className="font-semibold text-lime">
                Body
              </Link>{' '}
              to earn protein day points.
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function PastWinners({ winners }: { winners: Winner[] }) {
  if (winners.length === 0) return null;
  return (
    <Section title="Past winners" id="past-winners">
      <ul
        className="divide-y-[0.5px] divide-divider rounded-card bg-surface px-4"
        data-past-winners
      >
        {winners.map((w) => (
          <li key={`${w.period}-${w.startsOn}`} className="flex items-center gap-3 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gold-dim text-gold">
              <Trophy className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="type-headline block truncate text-text-1">
                @{w.username}
                {w.me ? <span className="type-subhead ml-1.5 text-text-2">You</span> : null}
              </span>
              <span className="type-subhead block text-text-2">
                {w.period === 'week'
                  ? `Week of ${dateLabel(w.startsOn)}`
                  : new Date(`${w.startsOn}T00:00:00`).toLocaleDateString('en-IN', {
                      month: 'long',
                      year: 'numeric',
                    })}
              </span>
            </span>
            <span className="type-subhead tabular shrink-0 text-text-2">{w.score} pts</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function RenameForm({
  groupId,
  initial,
  onDone,
}: {
  groupId: string;
  initial: string;
  onDone: () => void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = name.trim().replace(/\s+/g, ' ');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clean || busy) return;
    setBusy(true);
    try {
      await renameGroup(groupId, clean);
      onDone();
    } catch (err) {
      setError(err instanceof CommunityError ? err.message : 'Could not rename it. Try again.');
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <TextField
        label="Group name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        autoFocus
      />
      {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}
      <PrimaryButton type="submit" block loading={busy} disabled={!clean || clean === initial}>
        Save name
      </PrimaryButton>
    </form>
  );
}

function RemoveList({
  groupId,
  usernames,
  onRemoved,
}: {
  groupId: string;
  usernames: string[];
  onRemoved: (username: string) => void;
}) {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState<string[]>([]);
  const toast = useToast();
  const left = usernames.filter((u) => !gone.includes(u));
  return (
    <>
      {left.length === 0 ? (
        <p className="type-meta text-text-2">No one else is in the group.</p>
      ) : (
        <ul className="divide-y-[0.5px] divide-divider" data-remove-list>
          {left.map((u) => (
            <li key={u} className="flex items-center gap-3 py-2.5">
              <MemberAvatar username={u} />
              <span className="type-headline min-w-0 flex-1 truncate text-text-1">@{u}</span>
              <TextButton small onClick={() => setConfirm(u)} data-remove-member={u}>
                Remove
              </TextButton>
            </li>
          ))}
        </ul>
      )}
      <ConfirmSheet
        open={confirm !== null}
        title={`Remove @${confirm ?? ''}?`}
        body="They leave the group and its leaderboard. They can join again only with the code."
        confirmLabel="Remove"
        destructive
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          setBusy(true);
          try {
            await removeMember(groupId, confirm);
            setGone((g) => [...g, confirm]);
            onRemoved(confirm);
          } catch (err) {
            toast(
              err instanceof CommunityError ? err.message : 'Could not remove them. Try again.',
            );
          } finally {
            setBusy(false);
            setConfirm(null);
          }
        }}
      />
    </>
  );
}

function CodeConfirm({
  open,
  groupId,
  onClose,
  onDone,
}: {
  open: boolean;
  groupId: string;
  onClose: () => void;
  onDone: (code: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <ConfirmSheet
      open={open}
      title="Make a new code?"
      body="The old code stops working at once. Everyone already in the group stays in."
      confirmLabel="Make new code"
      busy={busy}
      onClose={onClose}
      onConfirm={async () => {
        setBusy(true);
        try {
          onDone(await newGroupCode(groupId));
        } catch (err) {
          toast(err instanceof CommunityError ? err.message : 'Could not do that. Try again.');
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

function LeaveConfirm({
  open,
  groupId,
  name,
  alone,
  onClose,
  onLeft,
}: {
  open: boolean;
  groupId: string;
  name: string;
  alone: boolean;
  onClose: () => void;
  onLeft: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  return (
    <ConfirmSheet
      open={open}
      title={`Leave ${name}?`}
      body={
        alone
          ? 'You are the only member, so the group will be deleted.'
          : 'You can join again with the code. Your own workouts and records are not affected.'
      }
      confirmLabel="Leave group"
      destructive
      busy={busy}
      onClose={onClose}
      onConfirm={async () => {
        setBusy(true);
        try {
          await leaveGroup(groupId);
          onLeft();
        } catch (err) {
          toast(err instanceof CommunityError ? err.message : 'Could not leave. Try again.');
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
