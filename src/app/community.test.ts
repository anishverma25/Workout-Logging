import {
  __test,
  cleanCode,
  cleanUsername,
  formatCode,
  messageFor,
  scoreParts,
  usernameProblem,
} from './community';

describe('usernames typed in the app', () => {
  it('are cleaned the way the server stores them', () => {
    expect(cleanUsername('  @Anish.Lifts ')).toBe('anish.lifts');
  });
  it('explain what is wrong before sending', () => {
    expect(usernameProblem('ab')).toMatch(/3 characters/);
    expect(usernameProblem('a'.repeat(21))).toMatch(/20 characters/);
    expect(usernameProblem('anish verma')).toMatch(/letters, numbers/);
    expect(usernameProblem('.anish')).toMatch(/Start and end/);
    expect(usernameProblem('an__ish')).toMatch(/two dots/);
    expect(usernameProblem('anish_99')).toBeNull();
  });
});

describe('join codes', () => {
  it('accept any case, spaces and dashes, and read in two halves', () => {
    expect(cleanCode(' abc-2x9 ')).toBe('ABC2X9');
    expect(formatCode('ABC2X9')).toBe('ABC-2X9');
  });
});

describe('server answers', () => {
  it('become plain sentences, including before the server is updated', () => {
    expect(messageFor({ message: 'Username taken' })).toMatch(/taken/);
    expect(messageFor({ message: 'Group limit 3 reached' })).toMatch(/3 groups/);
    expect(messageFor({ message: 'This group is full' })).toMatch(/30 people/);
    expect(messageFor({ code: 'PGRST202', message: 'Could not find the function' })).toMatch(
      /not available yet/,
    );
    expect(messageFor(null)).toMatch(/connection/);
  });

  it('read a board, sorted by rank, with Pro totals only when sent', () => {
    const board = __test.parseBoard({
      group: { id: 'g', name: 'Iron', code: 'ABC234', role: 'admin', members: 2 },
      period: 'week',
      starts_on: '2026-11-02',
      ends_on: '2026-11-08',
      locked: false,
      pro: false,
      trained_today: ['a.b'],
      rows: [
        {
          rank: 2,
          username: 'b',
          me: true,
          score: 13,
          workouts: 1,
          hard_sets: 3,
          records: 0,
          protein_days: 0,
        },
        {
          rank: 1,
          username: 'a',
          score: 26,
          workouts: 2,
          hard_sets: 6,
          records: 0,
          protein_days: 0,
        },
      ],
    });
    expect(board.rows.map((r) => r.username)).toEqual(['a', 'b']);
    expect(board.rows[1]!.me).toBe(true);
    expect(board.rows[0]!.volumeKg).toBeNull();
    expect(scoreParts(board.rows[0]!).reduce((n, p) => n + p.points, 0)).toBe(26);
  });
});
