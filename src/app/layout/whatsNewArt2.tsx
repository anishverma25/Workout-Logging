import { Crown, Dumbbell, Medal, Repeat2, Tag } from 'lucide-react';
import { Dot, Frame, Row } from './whatsNewArt';

/**
 * Drawings for the November 2026 release (fair play, paying your way, the new look). Built from
 * the app's tokens; every figure is an example and each frame says so.
 */

/** A group board with points from effort, and the leader's routine to copy. */
export function BoardArt() {
  const rows = [
    { n: 1, name: 'You', pts: 96, pro: true },
    { n: 2, name: 'Gym buddy', pts: 88, pro: false },
    { n: 3, name: 'Roommate', pts: 71, pro: false },
  ];
  return (
    <Frame label="A group leaderboard: you first with 96 points, and the leader's routine ready to copy">
      <div className="flex flex-col gap-2 pt-4">
        {rows.map((r) => (
          <Row key={r.n}>
            <span
              className={`type-subhead flex size-8 shrink-0 items-center justify-center rounded-full font-bold tabular ${r.n === 1 ? 'bg-lime text-on-lime' : 'bg-fill text-text-1'}`}
            >
              {r.n}
            </span>
            <span className="type-subhead flex min-w-0 flex-1 items-center gap-1.5 font-semibold text-text-1">
              {r.name}
              {r.pro ? <Crown className="size-3.5 text-gold" /> : null}
            </span>
            <span className="type-subhead font-semibold text-lime tabular">{r.pts} pts</span>
          </Row>
        ))}
        <div className="flex items-center justify-between rounded-nested bg-lime-dim px-3 py-2.5">
          <span className="type-caption text-left text-text-1">
            Push Pull Legs · 6 days
            <br />
            <span className="text-text-2">Their split and exercises, no weights</span>
          </span>
          <span className="type-caption flex items-center gap-1 rounded-full bg-lime px-2.5 py-1 font-semibold text-on-lime">
            <Repeat2 className="size-3.5" />
            Copy
          </span>
        </div>
      </div>
    </Frame>
  );
}

/** Autopay or pay once, with a code at checkout. */
export function PayArt() {
  return (
    <Frame label="Choosing a plan: autopay or pay once, and a code field at checkout">
      <div className="flex flex-col gap-2 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-nested bg-surface px-3 py-2.5 text-left ring-1 ring-lime">
            <p className="type-subhead font-semibold text-text-1">Autopay</p>
            <p className="type-caption text-text-2">Renews, turn off any time</p>
          </div>
          <div className="rounded-nested bg-surface px-3 py-2.5 text-left">
            <p className="type-subhead font-semibold text-text-1">Pay once</p>
            <p className="type-caption text-text-2">No renewal</p>
          </div>
        </div>
        <Row>
          <Dot>
            <Tag className="size-4" />
          </Dot>
          <span className="type-subhead min-w-0 flex-1 text-text-2">Have a code?</span>
          <span className="type-caption rounded-full bg-fill px-2.5 py-1 font-semibold text-text-1">
            Apply
          </span>
        </Row>
        <div className="flex h-11 items-center justify-center rounded-full bg-lime">
          <span className="type-subhead font-semibold text-on-lime">Continue to payment</span>
        </div>
      </div>
    </Frame>
  );
}

/** Home's new map of the week, and a routine template's week at a glance. */
export function LookArt() {
  const week = ['Push', 'Pull', 'Legs', '', 'Push', 'Pull', ''];
  return (
    <Frame label="A template's week at a glance, and the muscles trained this week">
      <div className="flex flex-col gap-2 pt-4">
        <ol className="grid grid-cols-7 gap-1 rounded-nested bg-surface p-2">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <li key={i} className="flex flex-col items-center gap-1">
              <span className="type-caption text-text-3">{d}</span>
              <span
                className={`type-caption flex h-7 w-full items-center justify-center rounded-[0.4rem] font-semibold ${week[i] ? 'bg-lime text-on-lime' : 'text-text-3'}`}
              >
                {week[i] || '·'}
              </span>
            </li>
          ))}
        </ol>
        <Row>
          <Dot>
            <Dumbbell className="size-4" />
          </Dot>
          <div className="min-w-0 flex-1 text-left">
            <p className="type-subhead font-semibold text-text-1">Muscles this week</p>
            <p className="type-caption text-text-2">Chest 12 sets · Back 10 · Quads 8</p>
          </div>
        </Row>
        <Row>
          <Dot>
            <Medal className="size-4" />
          </Dot>
          <div className="min-w-0 flex-1 text-left">
            <p className="type-subhead font-semibold text-text-1">Every source, with its year</p>
            <p className="type-caption text-text-2">On the science page, linked to the paper</p>
          </div>
        </Row>
      </div>
    </Frame>
  );
}
