import { useEffect, useState } from 'react';
import { supabase } from '@/data/sync/supabase';

/**
 * Friends, groups and leaderboards (November 2026). Everything here talks to the server's
 * functions in migration 0019: usernames, groups joined by code, and weekly and monthly boards.
 * Scores are worked out on the server from synced workouts and food logs; the phone never sends
 * one. Other people's workouts never reach the phone: only usernames, points and totals.
 */

export type Period = 'week' | 'month';

export interface MyGroup {
  id: string;
  name: string;
  code: string;
  role: 'admin' | 'member';
  members: number;
  rank: number | null;
  score: number;
  leader: string | null;
  /** The person just above, and how many points behind them. */
  above: string | null;
  behindBy: number | null;
}

export interface BoardRow {
  rank: number;
  username: string;
  me: boolean;
  score: number;
  workouts: number;
  hardSets: number;
  records: number;
  proteinDays: number;
  /** Weeks in the period with 3+ training days (migration 0026; 0 before). */
  consistencyWeeks: number;
  /** Points for getting stronger on 3+ lifts, up to 10 (migration 0026; 0 before). */
  progressPoints: number;
  hasProteinTarget: boolean;
  /** Pro only: the totals behind the extra boards. */
  activeDays: number | null;
  volumeKg: number | null;
  progressPct: number | null;
}

export interface Board {
  group: { id: string; name: string; code: string; role: 'admin' | 'member'; members: number };
  period: Period;
  startsOn: string;
  endsOn: string;
  locked: boolean;
  /** False for a finished period from before the group existed. */
  available: boolean;
  pro: boolean;
  trainedToday: string[];
  rows: BoardRow[];
}

export interface Winner {
  period: Period;
  startsOn: string;
  username: string;
  score: number;
  me: boolean;
}

export type UsernameCheck = 'ok' | 'taken' | 'reserved' | 'invalid';

export class CommunityError extends Error {}

const num = (x: unknown): number | null =>
  x === null || x === undefined || x === '' || Number.isNaN(Number(x)) ? null : Number(x);
const str = (x: unknown): string => (typeof x === 'string' ? x : '');

function parseGroup(v: Record<string, unknown>): MyGroup {
  return {
    id: str(v.id),
    name: str(v.name),
    code: str(v.code),
    role: v.role === 'admin' ? 'admin' : 'member',
    members: num(v.members) ?? 1,
    rank: num(v.rank),
    score: num(v.score) ?? 0,
    leader: typeof v.leader === 'string' ? v.leader : null,
    above: typeof v.above === 'string' ? v.above : null,
    behindBy: num(v.behind_by),
  };
}

function parseRow(v: Record<string, unknown>): BoardRow {
  return {
    rank: num(v.rank) ?? 0,
    username: str(v.username),
    me: v.me === true,
    score: num(v.score) ?? 0,
    workouts: num(v.workouts) ?? 0,
    hardSets: num(v.hard_sets) ?? 0,
    records: num(v.records) ?? 0,
    proteinDays: num(v.protein_days) ?? 0,
    consistencyWeeks: num(v.consistency_weeks) ?? 0,
    progressPoints: num(v.progress_points) ?? 0,
    hasProteinTarget: v.has_protein_target === true,
    activeDays: num(v.active_days),
    volumeKg: num(v.volume_kg),
    progressPct: num(v.progress_pct),
  };
}

function parseBoard(v: Record<string, unknown>): Board {
  const g = (v.group ?? {}) as Record<string, unknown>;
  return {
    group: {
      id: str(g.id),
      name: str(g.name),
      code: str(g.code),
      role: g.role === 'admin' ? 'admin' : 'member',
      members: num(g.members) ?? 1,
    },
    period: v.period === 'month' ? 'month' : 'week',
    startsOn: str(v.starts_on),
    endsOn: str(v.ends_on),
    locked: v.locked === true,
    available: v.available !== false,
    pro: v.pro === true,
    trainedToday: Array.isArray(v.trained_today) ? v.trained_today.map(str) : [],
    rows: Array.isArray(v.rows)
      ? (v.rows as Record<string, unknown>[]).map(parseRow).sort((a, b) => a.rank - b.rank)
      : [],
  };
}

function parseWinner(v: Record<string, unknown>): Winner {
  return {
    period: v.period === 'month' ? 'month' : 'week',
    startsOn: str(v.starts_on),
    username: str(v.username),
    score: num(v.score) ?? 0,
    me: v.me === true,
  };
}

/** What a person types as a username, as the server will store it. */
export function cleanUsername(raw: string): string {
  return raw.trim().replace(/^@+/, '').toLowerCase();
}

/** The same rules as the server, to explain a name before sending it. */
export function usernameProblem(raw: string): string | null {
  const name = cleanUsername(raw);
  if (name.length < 3) return 'At least 3 characters.';
  if (name.length > 20) return 'At most 20 characters.';
  if (!/^[a-z0-9._]+$/.test(name)) return 'Use letters, numbers, dots and underscores only.';
  if (!/^[a-z0-9]/.test(name) || !/[a-z0-9]$/.test(name))
    return 'Start and end with a letter or number.';
  if (/[._]{2}/.test(name)) return 'No two dots or underscores in a row.';
  return null;
}

/** A join code as people type it: any case, spaces or dashes. */
export function cleanCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** ABC-DEF, easier to read out. */
export const formatCode = (code: string) =>
  code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;

/** A friendly sentence for every way a call can fail. */
export function messageFor(error: { message?: string; code?: string } | null): string {
  const m = error?.message ?? '';
  if (/Username taken/i.test(m)) return 'That username is taken. Try another.';
  if (/Reserved username/i.test(m)) return 'That username is not available. Try another.';
  if (/Invalid username/i.test(m)) return 'Use 3 to 20 letters, numbers, dots or underscores.';
  if (/username first/i.test(m)) return 'Choose a username first.';
  if (/Group limit (\d+)/i.test(m)) {
    const n = /Group limit (\d+)/i.exec(m)![1];
    return n === '3'
      ? 'You are in 3 groups, the most on the free plan. Leave one, or get Pro for up to 10.'
      : `You are in ${n} groups, the most allowed.`;
  }
  if (/No group has that code/i.test(m)) return 'No group has that code. Check it and try again.';
  if (/group is full/i.test(m)) return 'This group is full (30 people).';
  if (/group admin/i.test(m)) return 'Only the group admin can do that.';
  if (/Not a member/i.test(m)) return 'You are not in this group any more.';
  if (/1 to 40/i.test(m)) return 'Group names are 1 to 40 characters.';
  if (/Duel exists/i.test(m)) return 'You two already have a duel this week.';
  if (/Duel limit (\d+)/i.test(m)) return 'You can start 3 duels a week.';
  if (/Duel yourself|No member with that username/i.test(m)) return 'Choose another member of this group.';
  // The server has not been updated yet (migration 0019 not run).
  if (error?.code === 'PGRST202' || /does not exist|Could not find the function/i.test(m))
    return 'Groups are not available yet. Please try again later.';
  return 'Could not reach Macrotrophy. Check your connection and try again.';
}

async function call<T>(fn: string, args: Record<string, unknown>, parse: (v: unknown) => T) {
  if (!supabase) throw new CommunityError('Accounts are not set up in this version of the app.');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new CommunityError(messageFor(error));
  return parse(data);
}

export const getMyUsername = () =>
  call('get_my_username', {}, (v) => (typeof v === 'string' && v ? v : null));

export const checkUsername = (name: string) =>
  call('check_username', { p_username: cleanUsername(name) }, (v) =>
    v === 'ok' || v === 'taken' || v === 'reserved' ? (v as UsernameCheck) : 'invalid',
  );

export const setUsername = (name: string) =>
  call('set_username', { p_username: cleanUsername(name) }, (v) => str(v));

export const getMyGroups = () =>
  call('get_my_groups', {}, (v) =>
    Array.isArray(v) ? (v as Record<string, unknown>[]).map(parseGroup) : [],
  );

export const createGroup = (name: string) =>
  call('create_group', { p_name: name.trim().replace(/\s+/g, ' ') }, (v) => {
    const g = (v ?? {}) as Record<string, unknown>;
    return { id: str(g.id), name: str(g.name), code: str(g.code) };
  });

export const joinGroup = (code: string) =>
  call('join_group', { p_code: cleanCode(code) }, (v) => {
    const g = (v ?? {}) as Record<string, unknown>;
    return { id: str(g.id), name: str(g.name), already: g.already === true };
  });

export const getBoard = (groupId: string, period: Period, offset: 0 | -1) =>
  call('get_group_board', { p_group: groupId, p_period: period, p_offset: offset }, (v) =>
    parseBoard((v ?? {}) as Record<string, unknown>),
  );

export const getWinners = (groupId: string) =>
  call('get_group_winners', { p_group: groupId }, (v) =>
    Array.isArray(v) ? (v as Record<string, unknown>[]).map(parseWinner) : [],
  );

export const getAvatars = (groupId: string, usernames: string[]) =>
  call('get_group_avatars', { p_group: groupId, p_usernames: usernames.slice(0, 6) }, (v) => {
    const out: Record<string, string> = {};
    for (const [k, a] of Object.entries((v ?? {}) as Record<string, unknown>)) {
      if (typeof a === 'string' && a.startsWith('data:image/')) out[k] = a;
    }
    return out;
  });

export const leaveGroup = (groupId: string) =>
  call('leave_group', { p_group: groupId }, (v) => v === true);

export const renameGroup = (groupId: string, name: string) =>
  call('rename_group', { p_group: groupId, p_name: name.trim().replace(/\s+/g, ' ') }, str);

export const newGroupCode = (groupId: string) => call('new_group_code', { p_group: groupId }, str);

export const removeMember = (groupId: string, username: string) =>
  call('remove_group_member', { p_group: groupId, p_username: username }, (v) => v === true);

/**
 * A server answer for the current key, refetched when `version` changes. `undefined` while
 * loading, `null` with `error` set when it failed.
 */
export function useRemote<T>(load: (() => Promise<T>) | null, key: string) {
  const [result, setResult] = useState<{
    key: string;
    data: T | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    if (!load) return;
    let live = true;
    load().then(
      (data) => {
        if (live) setResult({ key, data, error: null });
      },
      (err: unknown) => {
        if (live)
          setResult({
            key,
            data: null,
            error: err instanceof CommunityError ? err.message : messageFor(null),
          });
      },
    );
    return () => {
      live = false;
    };
    // `load` changes every render; the key says when the request is really different.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = load && result?.key === key ? result : null;
  return {
    data: current ? current.data : undefined,
    error: current?.error ?? null,
    loading: !!load && current === null,
  };
}

/** Points for each part of the Macrotrophy Score: the same numbers as the server. */
export const POINTS = { workout: 10, hardSet: 1, record: 5, proteinDay: 3, consistencyWeek: 10 } as const;
export const WEEKLY_CAPS = { workouts: 6, hardSets: 25, records: 5, progress: 10 } as const;

type ScoreFields = Pick<
  BoardRow,
  'workouts' | 'hardSets' | 'records' | 'proteinDays' | 'consistencyWeeks' | 'progressPoints'
>;

/** The breakdown of one person's score, in points. Bonuses show only once earned. */
export function scoreParts(r: ScoreFields) {
  const parts = [
    { key: 'workouts', label: 'Workouts', count: r.workouts, points: r.workouts * POINTS.workout },
    { key: 'hardSets', label: 'Hard sets', count: r.hardSets, points: r.hardSets * POINTS.hardSet },
    { key: 'records', label: 'Records', count: r.records, points: r.records * POINTS.record },
    {
      key: 'proteinDays',
      label: 'Protein days',
      count: r.proteinDays,
      points: r.proteinDays * POINTS.proteinDay,
    },
    {
      key: 'consistency',
      label: 'Consistency',
      count: r.consistencyWeeks,
      points: r.consistencyWeeks * POINTS.consistencyWeek,
    },
    { key: 'progress', label: 'Getting stronger', count: r.progressPoints, points: r.progressPoints },
  ];
  return parts.filter(
    (p) => !(p.key === 'consistency' || p.key === 'progress') || p.points > 0,
  );
}

// ---------------------------------------------------------------------------------------------
// Routines on the boards (migration 0026): the plan only, never weights.
// ---------------------------------------------------------------------------------------------

export interface BoardRoutineExercise {
  /** Null for an exercise of their own, which cannot be copied. */
  exerciseId: string | null;
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  rir: number | null;
}
export interface BoardRoutine {
  name: string;
  days: { name: string; weekdays: number[]; exercises: BoardRoutineExercise[] }[];
}

export function parseBoardRoutine(v: unknown): BoardRoutine | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const days = Array.isArray(o.days) ? (o.days as Record<string, unknown>[]) : [];
  const parsed = {
    name: str(o.name) || 'Routine',
    days: days.map((d) => ({
      name: str(d.name) || 'Day',
      weekdays: Array.isArray(d.weekdays)
        ? (d.weekdays as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
        : [],
      exercises: (Array.isArray(d.exercises) ? (d.exercises as Record<string, unknown>[]) : []).map(
        (e) => ({
          exerciseId: typeof e.exercise_id === 'string' && e.exercise_id ? e.exercise_id : null,
          name: str(e.name) || 'Exercise',
          sets: Math.max(1, Math.min(20, num(e.sets) ?? 3)),
          repMin: Math.max(1, num(e.rep_min) ?? 8),
          repMax: Math.max(1, num(e.rep_max) ?? 12),
          rir: num(e.rir),
        }),
      ),
    })),
  };
  return parsed.days.length ? parsed : null;
}

export const getBoardRoutine = (period: Period, offset: 0 | -1, rank: number) =>
  call('get_board_routine', { p_period: period, p_offset: offset, p_rank: rank }, parseBoardRoutine);

export const getMemberRoutine = (groupId: string, username: string) =>
  call('get_member_routine', { p_group: groupId, p_username: username }, parseBoardRoutine);

export const setShareRoutine = (on: boolean) =>
  call('set_share_routine', { p_on: on }, (v) => v !== false);

// ---------------------------------------------------------------------------------------------
// The global leaderboard: everyone on Macrotrophy, by name; usernames only when shown.
// ---------------------------------------------------------------------------------------------

export interface GlobalRow {
  rank: number;
  name: string;
  /** Only when its owner chose to show it. */
  username: string | null;
  avatar: string | null;
  me: boolean;
  score: number;
  workouts: number;
  hardSets: number;
  records: number;
  proteinDays: number;
  consistencyWeeks: number;
  progressPoints: number;
}

export interface GlobalBoard {
  period: Period;
  startsOn: string;
  endsOn: string;
  locked: boolean;
  /** Everyone with points in the period. */
  total: number;
  /** The top 100. */
  rows: GlobalRow[];
  mine: GlobalRow | null;
  showUsername: boolean;
  hasUsername: boolean;
  /** Whether the caller's routine plan shows to people who tap them on a board. */
  shareRoutine: boolean;
}

function parseGlobalRow(v: Record<string, unknown>): GlobalRow {
  const avatar =
    typeof v.avatar === 'string' && v.avatar.startsWith('data:image/') ? v.avatar : null;
  return {
    rank: num(v.rank) ?? 0,
    // The server names someone with no profile name 'Overload member' (migration 0020).
    name: !str(v.name) || str(v.name) === 'Overload member' ? 'Macrotrophy member' : str(v.name),
    username: typeof v.username === 'string' && v.username ? v.username : null,
    avatar,
    me: v.me === true,
    score: num(v.score) ?? 0,
    workouts: num(v.workouts) ?? 0,
    hardSets: num(v.hard_sets) ?? 0,
    records: num(v.records) ?? 0,
    proteinDays: num(v.protein_days) ?? 0,
    consistencyWeeks: num(v.consistency_weeks) ?? 0,
    progressPoints: num(v.progress_points) ?? 0,
  };
}

function parseGlobal(v: Record<string, unknown>): GlobalBoard {
  return {
    period: v.period === 'month' ? 'month' : 'week',
    startsOn: str(v.starts_on),
    endsOn: str(v.ends_on),
    locked: v.locked === true,
    total: num(v.total) ?? 0,
    rows: Array.isArray(v.rows)
      ? (v.rows as Record<string, unknown>[]).map(parseGlobalRow).sort((a, b) => a.rank - b.rank)
      : [],
    mine:
      v.mine && typeof v.mine === 'object'
        ? parseGlobalRow(v.mine as Record<string, unknown>)
        : null,
    showUsername: v.show_username === true,
    hasUsername: v.has_username === true,
    // On unless the person turned it off (servers before 0026 do not say: treat as on).
    shareRoutine: v.share_routine !== false,
  };
}

export const getGlobalBoard = (period: Period, offset: 0 | -1) =>
  call('get_global_board', { p_period: period, p_offset: offset }, (v) =>
    parseGlobal((v ?? {}) as Record<string, unknown>),
  );

export const getMyStanding = () =>
  call('get_my_global_standing', {}, (v) => {
    const o = (v ?? {}) as Record<string, unknown>;
    return { rank: num(o.rank), score: num(o.score) ?? 0, total: num(o.total) ?? 0 };
  });

export const setShowUsername = (show: boolean) =>
  call('set_show_username', { p_show: show }, (v) => v === true);

export const __test = { parseBoard, parseGroup, parseRow, parseGlobal };

// ---------------------------------------------------------------------------------------------
// Duels (migration 0023): one member against another for the week, on the same weekly points.
// ---------------------------------------------------------------------------------------------

export interface Duel {
  id: string;
  weekStart: string;
  /** This week's (points still moving) or last week's (settled). */
  live: boolean;
  challenger: string;
  opponent: string;
  challengerScore: number;
  opponentScore: number;
  mine: boolean;
  iAmChallenger: boolean;
}

export interface Duels {
  weekStart: string;
  endsOn: string;
  limit: number;
  duels: Duel[];
}

export const getDuels = (groupId: string) =>
  call('get_group_duels', { p_group: groupId }, (v): Duels => {
    const o = (v ?? {}) as Record<string, unknown>;
    return {
      weekStart: str(o.week_start),
      endsOn: str(o.ends_on),
      limit: num(o.limit) ?? 3,
      duels: (Array.isArray(o.duels) ? (o.duels as Record<string, unknown>[]) : []).map((d) => ({
        id: str(d.id),
        weekStart: str(d.week_start),
        live: d.live === true,
        challenger: str(d.challenger),
        opponent: str(d.opponent),
        challengerScore: num(d.challenger_score) ?? 0,
        opponentScore: num(d.opponent_score) ?? 0,
        mine: d.mine === true,
        iAmChallenger: d.i_am_challenger === true,
      })),
    };
  });

export const createDuel = (groupId: string, username: string) =>
  call('create_duel', { p_group: groupId, p_username: username }, () => true);

export const cancelDuel = (duelId: string) =>
  call('cancel_duel', { p_duel: duelId }, (v) => v === true);
