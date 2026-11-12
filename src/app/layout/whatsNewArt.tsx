import type { ReactNode } from 'react';
import { Brain, Check, Flame, Mic, Plus, Sparkles, Swords, Utensils } from 'lucide-react';

/**
 * The drawings in the release walkthrough: small pictures of the new screens, built from the
 * same tokens as the app. Every figure in them is an example, and each frame says so.
 */

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-panel bg-surface-2 p-4"
      style={{ backgroundImage: 'radial-gradient(90% 70% at 50% 0%, var(--lime-dim), transparent 70%)' }}
      role="img"
      aria-label={label}
    >
      <span className="type-caption absolute top-2.5 right-3 text-text-3" aria-hidden>
        Example
      </span>
      <div aria-hidden>{children}</div>
    </div>
  );
}

const Row = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center gap-3 rounded-nested bg-surface px-3 py-2.5 text-left">{children}</div>
);
const Dot = ({ children }: { children: ReactNode }) => (
  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-lime">{children}</span>
);

/** Learn, decide, explain: the three steps of the brain. */
export function BrainArt() {
  const steps = [
    ['Learn', 'your weight, food and lifts'],
    ['Decide', 'next week, inside safe limits'],
    ['Explain', 'every change, with a Why'],
  ] as const;
  return (
    <Frame label="The app learns from your logs, decides next week and explains every change">
      <div className="flex flex-col items-center gap-3 pt-2">
        <span
          className="flex size-16 items-center justify-center rounded-full bg-lime text-on-lime"
          style={{ boxShadow: '0 0 48px var(--lime-dim), 0 0 16px var(--lime-dim)' }}
        >
          <Brain className="size-8" strokeWidth={1.6} />
        </span>
        <ol className="grid w-full grid-cols-3 gap-2">
          {steps.map(([title, text], i) => (
            <li key={title} className="rounded-nested bg-surface px-2 py-2.5 text-center">
              <p className="type-caption tabular text-lime">{i + 1}</p>
              <p className="type-subhead font-semibold text-text-1">{title}</p>
              <p className="type-caption text-text-2">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </Frame>
  );
}

/** The weekly review with two proposed changes and Apply. */
export function PlanArt() {
  return (
    <Frame label="Next week: two proposed changes, each with its reason, and an Apply button">
      <p className="type-caption text-left text-lime">Next week</p>
      <div className="mt-2 flex flex-col gap-2">
        <Row>
          <Dot>
            <Flame className="size-4" />
          </Dot>
          <div className="min-w-0">
            <p className="type-subhead font-semibold text-text-1">Calories 2,300 to 2,200</p>
            <p className="type-caption text-text-2">Your weight held steady; the plan is a slow cut.</p>
          </div>
        </Row>
        <Row>
          <Dot>
            <Plus className="size-4" />
          </Dot>
          <div className="min-w-0">
            <p className="type-subhead font-semibold text-text-1">Quads plus 2 sets a week</p>
            <p className="type-caption text-text-2">Lifts have not moved in 4 weeks.</p>
          </div>
        </Row>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <span className="type-subhead rounded-full bg-lime py-2 text-center font-semibold text-on-lime">Apply changes</span>
          <span className="type-subhead rounded-full bg-fill py-2 text-center font-semibold text-text-1">Keep my plan</span>
        </div>
      </div>
    </Frame>
  );
}

/** Life events and pain as chips feeding the plan. */
export function LifeArt() {
  const chips = ['Exams', 'Travel', 'Wedding', 'Vrat', 'Ramadan', 'Unwell'];
  return (
    <Frame label="Coming up: exams, travel, a wedding, a fast. Something hurts: shoulder, mild">
      <p className="type-caption text-left text-lime">Coming up</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <span
            key={c}
            className={
              i === 0
                ? 'type-caption rounded-full bg-text-1 px-2.5 py-1 font-semibold text-bg'
                : 'type-caption rounded-full bg-surface px-2.5 py-1 text-text-2'
            }
          >
            {c}
          </span>
        ))}
      </div>
      <div className="mt-3">
        <Row>
          <Dot>
            <Check className="size-4" />
          </Dot>
          <div className="min-w-0">
            <p className="type-subhead font-semibold text-text-1">Overhead press to machine press</p>
            <p className="type-caption text-text-2">Your shoulder hurt. Back in 2 weeks.</p>
          </div>
        </Row>
      </div>
    </Frame>
  );
}

/** Eat next with three foods and one-tap add. */
export function FoodArt() {
  const foods = [
    ['Boiled eggs', '2 eggs · 12 g protein'],
    ['Curd', '1 katori · 6 g protein'],
    ['Roasted chana', '30 g · 6 g protein'],
  ] as const;
  return (
    <Frame label="Eat next: what is left today and three foods that fit, each added with one tap">
      <p className="type-caption text-left text-lime">Eat next</p>
      <p className="type-subhead mt-1 text-left text-text-2">
        <span className="font-semibold text-text-1">640 kcal</span> and{' '}
        <span className="font-semibold text-text-1">48 g protein</span> left today
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {foods.map(([name, detail]) => (
          <Row key={name}>
            <Dot>
              <Utensils className="size-4" />
            </Dot>
            <div className="min-w-0 flex-1">
              <p className="type-subhead font-semibold text-text-1">{name}</p>
              <p className="type-caption text-text-2">{detail}</p>
            </div>
            <span className="flex size-7 items-center justify-center rounded-full bg-fill text-lime">
              <Plus className="size-4" />
            </span>
          </Row>
        ))}
      </div>
    </Frame>
  );
}

/** A mic with a sound wave and what was heard. */
export function VoiceArt() {
  const bars = [10, 22, 34, 18, 40, 26, 14, 30, 20, 36, 12, 24];
  return (
    <Frame label="Say 80 ke 8 and the set is logged">
      <div className="flex flex-col items-center gap-3 pt-2">
        <div className="flex items-center gap-3">
          <span
            className="flex size-14 items-center justify-center rounded-full bg-lime text-on-lime"
            style={{ boxShadow: '0 0 40px var(--lime-dim)' }}
          >
            <Mic className="size-7" />
          </span>
          <div className="flex h-10 items-center gap-1">
            {bars.map((h, i) => (
              <span key={i} className="release-wave w-1 rounded-full bg-lime" style={{ height: h, animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        </div>
        <p className="type-headline text-text-1">"80 ke 8"</p>
        <div className="w-full">
          <Row>
            <Dot>
              <Check className="size-4" />
            </Dot>
            <p className="type-subhead font-semibold text-text-1">Bench press: 80 kg × 8 logged</p>
          </Row>
        </div>
      </div>
    </Frame>
  );
}

/** The Now card and the AI that remembers. */
export function NowArt() {
  return (
    <Frame label="A Now card on Home, and Macrotrophy AI remembering what you told it">
      <Row>
        <Dot>
          <Utensils className="size-4" />
        </Dot>
        <div className="min-w-0 flex-1">
          <p className="type-caption text-lime">Now</p>
          <p className="type-subhead font-semibold text-text-1">40 g protein left</p>
          <p className="type-caption text-text-2">These fit: curd, boiled eggs, chana.</p>
        </div>
        <span className="type-caption rounded-full bg-lime px-3 py-1.5 font-semibold text-on-lime">Add</span>
      </Row>
      <div className="mt-3 flex flex-col gap-1.5">
        <p className="type-caption text-left text-lime">What Macrotrophy AI knows</p>
        {['Exams from 16 to 22 Nov', 'Shoulder hurt (mild)', 'I train at 6 am before class'].map((t) => (
          <div key={t} className="flex items-center gap-2 rounded-nested bg-surface px-3 py-2 text-left">
            <Sparkles className="size-3.5 shrink-0 text-lime" />
            <p className="type-caption text-text-1">{t}</p>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** A duel bar and a wrapped tile. */
export function SocialArt() {
  return (
    <Frame label="A duel between two members and a monthly Wrapped card">
      <div className="rounded-nested bg-surface px-3 py-3">
        <div className="flex items-center justify-between">
          <p className="type-subhead font-semibold text-text-1">@riya</p>
          <p className="type-subhead tabular flex items-center gap-1.5 font-semibold text-text-1">
            86 <Swords className="size-4 text-lime" /> 71
          </p>
          <p className="type-subhead font-semibold text-text-2">@kabir</p>
        </div>
        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-fill">
          <span className="bg-lime" style={{ width: '55%' }} />
        </div>
      </div>
      <div
        className="mt-2 rounded-nested px-3 py-4 text-left"
        style={{ backgroundImage: 'linear-gradient(135deg, var(--lime-dim), transparent 75%)', backgroundColor: 'var(--surface)' }}
      >
        <p className="type-caption text-lime">October, wrapped</p>
        <p className="type-title text-text-1">
          14 <span className="type-subhead text-text-2">workouts</span>
        </p>
        <p className="type-caption text-text-2">41,200 kg lifted · 6 records</p>
      </div>
    </Frame>
  );
}
