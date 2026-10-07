import { feedbackProblem, feedbackStatus, SentFeedback, shouldAskForFeedback } from './feedback';

describe('feedback rules', () => {
  it('needs a rating or a message, within limits', () => {
    expect(feedbackProblem({ rating: null, tags: [], message: '  ' })).toMatch(/rating or write/);
    expect(feedbackProblem({ rating: 4, tags: [], message: '' })).toBeNull();
    expect(
      feedbackProblem({ rating: null, tags: ['idea'], message: 'Dark mode toggle' }),
    ).toBeNull();
    expect(feedbackProblem({ rating: 6, tags: [], message: '' })).toMatch(/1 and 5/);
    expect(feedbackProblem({ rating: 5, tags: [], message: 'x'.repeat(2001) })).toMatch(/under/);
  });

  it('asks once, after the third finished workout, only with an account', () => {
    const base = { signedIn: true, finishedWorkouts: 3, alreadyAsked: false };
    expect(shouldAskForFeedback(base)).toBe(true);
    expect(shouldAskForFeedback({ ...base, finishedWorkouts: 2 })).toBe(false);
    expect(shouldAskForFeedback({ ...base, alreadyAsked: true })).toBe(false);
    expect(shouldAskForFeedback({ ...base, signedIn: false })).toBe(false);
  });

  it('shows where each piece of feedback is', () => {
    expect(feedbackStatus({ pending: true })).toBe('waiting');
    expect(feedbackStatus({ seen_at: null, reply: null })).toBe('sent');
    expect(feedbackStatus({ seen_at: '2026-10-08T10:00:00Z', reply: null })).toBe('seen');
    expect(feedbackStatus({ seen_at: null, reply: 'Thanks!' })).toBe('replied');
  });

  it('reads server items and drops tags it does not know', () => {
    const item = SentFeedback.parse({
      id: 'a',
      rating: 5,
      tags: ['love', 'future-tag'],
      message: 'Great',
      created_at: '2026-10-08T10:00:00Z',
      seen_at: null,
      reply: null,
      replied_at: null,
    });
    expect(item.tags).toEqual(['love']);
  });
});
