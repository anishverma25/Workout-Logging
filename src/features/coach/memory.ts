import { eventsFrom, memoryFrom, type MemoryNote } from '@/data/repositories/plan';
import { EVENT_LABEL, PAIN_AREAS, PAIN_LABEL, type PainArea } from '@/domain/brain/life';
import type { PlanItem } from '@/domain/models/schemas';

/**
 * What Macrotrophy AI knows about the person beyond their numbers: what is coming up, what has
 * hurt lately, and the things they asked it to remember. Kept on the phone (and synced with
 * their other logs); it reaches the AI only as lines of the brief for one answer, with no name
 * or email, the same promise as the rest of the brief.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayMonth = (key: string) => {
  const d = new Date(`${key}T12:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** Pain reported this recently is still worth knowing about. */
export const PAIN_MEMORY_DAYS = 42;
/** The most notes sent with one question. */
export const MEMORY_BRIEF_NOTES = 15;

export interface KnownFact {
  /** note: the person's own words. event and pain come from Coming up and Something hurts. */
  kind: 'note' | 'event' | 'pain';
  id: string;
  text: string;
  note?: MemoryNote;
}

export function knownFacts(items: PlanItem[], today: string): KnownFact[] {
  const out: KnownFact[] = [];
  for (const e of eventsFrom(items, today))
    out.push({
      kind: 'event',
      id: e.id,
      text: `${EVENT_LABEL[e.kind].en} ${e.start === e.end ? `on ${dayMonth(e.start)}` : `from ${dayMonth(e.start)} to ${dayMonth(e.end)}`}`,
    });
  const since = new Date(`${today}T12:00:00Z`);
  since.setUTCDate(since.getUTCDate() - PAIN_MEMORY_DAYS);
  const from = since.toISOString().slice(0, 10);
  for (const i of items) {
    if (i.kind !== 'pain' || !i.startDate || i.startDate < from) continue;
    if (!PAIN_AREAS.includes(i.data.area as PainArea)) continue;
    out.push({
      kind: 'pain',
      id: i.id,
      text: `${PAIN_LABEL[i.data.area as PainArea].en} hurt (${String(i.data.severity ?? 'mild')}), reported ${dayMonth(i.startDate)}`,
    });
  }
  for (const n of memoryFrom(items)) out.push({ kind: 'note', id: n.id, text: n.text, note: n });
  return out;
}

/** The lines added to the brief. */
export function memoryLines(items: PlanItem[], today: string): string[] {
  const facts = knownFacts(items, today);
  const notes = facts.filter((f) => f.kind === 'note').slice(-MEMORY_BRIEF_NOTES);
  const rest = facts.filter((f) => f.kind !== 'note');
  return [...rest, ...notes].map((f) => `- ${f.text}.`.replace(/\.\.$/, '.'));
}

/**
 * Whether something the person typed in the chat reads like a lasting fact about them, worth
 * offering to remember: a statement about themselves, not a question.
 */
export function looksLikeFact(text: string): boolean {
  const t = text.trim();
  if (t.length < 12 || t.length > 160 || /\?/.test(t)) return false;
  if (/^(what|why|how|when|which|should|can|could|is|are|do|does|kya|kyu|kyun|kaise|kab|kitna)\b/i.test(t)) return false;
  return /^(i|i'm|im|i am|my|mera|meri|mere|main|mai|mujhe)\b/i.test(t);
}
