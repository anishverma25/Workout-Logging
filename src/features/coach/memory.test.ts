import { describe, expect, it } from 'vitest';
import type { PlanItem } from '@/domain/models/schemas';
import { buildBrief, BRIEF_ROOM } from './brief';
import { knownFacts, looksLikeFact, memoryLines } from './memory';

const meta = { createdAt: '2026-11-10T10:00:00.000Z', updatedAt: '2026-11-10T10:00:00.000Z', deletedAt: null, origin: 'user' as const };
const item = (n: number, over: Partial<PlanItem>): PlanItem => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, ...meta, kind: 'memory', startDate: null, endDate: null, status: 'active', data: {}, ...over,
});
const items = [
  item(1, { kind: 'event', startDate: '2026-11-16', endDate: '2026-11-22', data: { event: 'exams' } }),
  item(2, { kind: 'event', startDate: '2026-10-01', endDate: '2026-10-05', data: { event: 'travel' } }),
  item(3, { kind: 'pain', startDate: '2026-11-09', status: 'done', data: { area: 'shoulder', severity: 'mild' } }),
  item(4, { kind: 'pain', startDate: '2026-08-01', data: { area: 'knee', severity: 'mild' } }),
  item(5, { data: { text: 'I train at 6 am before class', source: 'typed' } }),
  item(6, { kind: 'decision', startDate: '2026-11-09', data: {} }),
];

describe('what Macrotrophy AI knows', () => {
  it('is what is coming up, what hurt lately and what the person told it', () => {
    expect(knownFacts(items, '2026-11-12').map((f) => [f.kind, f.text])).toEqual([
      ['event', 'Exams from 16 Nov to 22 Nov'],
      ['pain', 'Shoulder hurt (mild), reported 9 Nov'],
      ['note', 'I train at 6 am before class'],
    ]);
    expect(memoryLines(items, '2026-11-12')).toEqual([
      '- Exams from 16 Nov to 22 Nov.',
      '- Shoulder hurt (mild), reported 9 Nov.',
      '- I train at 6 am before class.',
    ]);
  });

  it('goes at the top of the brief, and gives way before the brief gets too long', () => {
    const input = { unit: 'kg' as const, now: new Date('2026-11-12T10:00:00'), profile: null, model: null };
    const plain = buildBrief('chat', input);
    const withMemory = buildBrief('chat', { ...input, memory: ['- I train at 6 am.'] });
    expect(withMemory.startsWith('What this person has told us')).toBe(true);
    expect(withMemory).toContain('- I train at 6 am.');
    expect(withMemory.endsWith(plain)).toBe(true);
    const many = Array.from({ length: 200 }, (_, i) => `- ${'x'.repeat(150)} ${i}.`);
    expect(buildBrief('chat', { ...input, memory: many }).length).toBeLessThanOrEqual(BRIEF_ROOM + 2);
  });

  it('offers to remember statements about the person, never questions', () => {
    for (const t of ['I am vegetarian and allergic to peanuts', 'My left knee was operated on last year', 'Main subah 6 baje train karta hoon', "I'm in a hostel with a mess"])
      expect(looksLikeFact(t), t).toBe(true);
    for (const t of ['Why is my bench stuck?', 'I am?', 'bench kyu nahi badh raha', 'How much protein do I need', 'ok', 'Should I deload this week'])
      expect(looksLikeFact(t), t).toBe(false);
  });
});
