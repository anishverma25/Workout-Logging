import { formatCalendarDate } from '@/lib/format';

export interface Milestone {
  when: string;
  title: string;
  detail: string;
}

/** The milestones for someone's answers. Every number comes from their own plan. */
export function milestonesFor(input: {
  days: number | null;
  programme: string | null;
  kcal: number | null;
  proteinG: number | null;
  target: { kg: number; date: string | null; direction: 'lose' | 'gain' | 'hold' } | null;
  unit: 'kg' | 'lb';
}): Milestone[] {
  const out: Milestone[] = [];
  const food =
    input.kcal && input.proteinG
      ? `Eat about ${input.kcal.toLocaleString('en-IN')} kcal and ${input.proteinG} g protein a day.`
      : 'Log what you eat, and the app starts learning your real maintenance.';
  out.push({
    when: 'This week',
    title: input.programme
      ? `${input.days ?? ''} ${input.days === 1 ? 'session' : 'sessions'} of ${input.programme}`.trim()
      : 'Your first sessions',
    detail: `${food} Every set you log builds your records.`,
  });
  out.push({
    when: 'Week 2',
    title: 'Your first weekly review, with Pro',
    detail:
      'What improved, what stalled, and next week proposed from your own numbers. Nothing changes without your yes.',
  });
  out.push({
    when: 'Week 4',
    title: 'Your real maintenance',
    detail: 'With food and weigh-ins logged, your calories come from your own body, not a formula.',
  });
  if (input.target && input.target.direction !== 'hold') {
    const date = input.target.date
      ? formatCalendarDate(new Date(`${input.target.date}T12:00:00`))
      : null;
    const shown =
      input.unit === 'lb'
        ? Math.round(input.target.kg * 2.20462)
        : Math.round(input.target.kg * 10) / 10;
    out.push({
      when: date ?? 'Your goal',
      title: `${shown} ${input.unit}`,
      detail: date
        ? 'At the pace your calories and protein are set for. The date moves as your real numbers come in.'
        : 'Your target weight. The plan re-dates it as your real numbers come in.',
    });
  } else {
    out.push({
      when: 'Week 12',
      title: 'Your own response',
      detail:
        'Enough of your logs to see which lifts answer best to how many sets, and to plan around it.',
    });
  }
  return out;
}
