import { muscleName } from '@/domain/analytics/weekly';
import { SET_BANDS, type SetBand } from '@/domain/brain/response';
import type { Brain } from '../brain/useBrain';

const BAND_TEXT: Record<SetBand, string> = {
  low: `under ${SET_BANDS.low[1]} weekly sets`,
  mid: `${SET_BANDS.mid[0]} to ${SET_BANDS.mid[1] - 1} weekly sets`,
  high: `${SET_BANDS.high[0]} or more weekly sets`,
};
const kcal = (v: number) => `${(Math.round(v / 10) * 10).toLocaleString('en-IN')} kcal`;

/**
 * What the adaptive plan worked out, as lines for Macrotrophy AI: so it can explain this week's
 * changes, the person's real maintenance and what their own logs have shown, in their words and
 * language, without ever calculating anything itself.
 */
export function planLines(brain: Brain, exerciseName: (id: string) => string): string[] {
  const { model, decision, record } = brain;
  if (!model) return [];
  const lines: string[] = [];
  const m = model.maintenance;
  if (m)
    lines.push(
      m.confidence === 'personal'
        ? `- Maintenance: about ${kcal(m.value)} a day, from their own food and weight over ${m.n} logged weeks.`
        : m.confidence === 'learning'
          ? `- Maintenance: about ${kcal(m.value)} a day, part their own logs (${m.n} weeks so far) and part the body formula.`
          : `- Maintenance: about ${kcal(m.value)} a day from the body formula; not enough food and weigh-ins logged yet to measure it.`,
    );
  if (model.stage.learning)
    lines.push(`- The plan is still learning their patterns: week ${Math.max(1, model.stage.week)} of ${model.stage.of}.`);
  for (const f of model.findings) {
    if (f.confidence !== 'personal' || !f.best) continue;
    if (f.kind === 'sets')
      lines.push(`- Their own logs show ${muscleName(f.subject).toLowerCase()} lifts progress best at ${BAND_TEXT[f.best as SetBand]}.`);
    if (f.kind === 'reps')
      lines.push(`- Their own logs show ${muscleName(f.subject).toLowerCase()} lifts progress best with ${f.best === 'heavy' ? 'heavy top sets of 1 to 5 reps' : 'top sets of 6 to 10 reps'}.`);
    if (f.kind === 'recovery')
      lines.push(`- Their own logs show ${muscleName(f.subject).toLowerCase()} lifts do better after ${f.best === 'long' ? '3 or more days of rest' : '2 days of rest or fewer'}.`);
    if (f.kind === 'energy' && f.best === 'fed')
      lines.push('- Their own logs show their lifts progress better in weeks they eat near maintenance than in weeks well under it.');
  }
  const trends = Object.entries(model.lifts)
    .sort((a, b) => b[1].weeks - a[1].weeks)
    .slice(0, 3);
  for (const [id, t] of trends)
    lines.push(
      `- ${exerciseName(id)}: estimated 1RM ${Math.round(t.latest)} kg, moving ${(t.weekly * 100).toFixed(1)}% a week over ${t.weeks} of the last 8 weeks.`,
    );
  if (decision) {
    const answered = record ? (record.outcome === 'applied' ? 'They applied it.' : 'They kept their plan.') : 'Not answered yet.';
    if (decision.changes.length) {
      lines.push(`- Changes proposed for the week of ${decision.weekStart} (${answered}):`);
      for (const c of decision.changes) lines.push(`  - ${c.title.en}: ${c.reason.en}`);
    } else lines.push(`- No changes proposed for the week of ${decision.weekStart}.`);
    for (const h of decision.holds) lines.push(`  - ${h.reason.en}`);
    for (const w of decision.warnings) lines.push(`  - Warning shown to them: ${w.text.en}`);
  }
  return lines;
}
