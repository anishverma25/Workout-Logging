import { createRng } from './random';
import { seededId, stableId } from './ids';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('ids', () => {
  it('derives the same valid UUID from the same key', () => {
    expect(stableId('exercise:back-squat')).toBe(stableId('exercise:back-squat'));
    expect(stableId('exercise:back-squat')).toMatch(UUID);
    expect(stableId('exercise:back-squat')).not.toBe(stableId('exercise:front-squat'));
  });

  it('generates deterministic valid UUIDs from a seed', () => {
    const a = createRng(1);
    const b = createRng(1);
    const id = seededId(a);
    expect(id).toMatch(UUID);
    expect(seededId(b)).toBe(id);
  });
});
