import { describe, expect, it, vi } from 'vitest';
import { joinSaid, listenPatiently, speechProblem, transcriptOf, type SpeechRecognitionLike } from './speech';

const result = (transcript: string, isFinal: boolean) => ({
  0: { transcript },
  length: 1,
  isFinal,
});

describe('speaking a meal', () => {
  it('keeps the sure words apart from the ones still being heard', () => {
    expect(transcriptOf([result('2 aloo parathas', true), result(' with  curd', false)])).toEqual({
      final: '2 aloo parathas',
      interim: 'with curd',
    });
  });

  it('adds what was said to what is typed', () => {
    expect(joinSaid('', '2 rotis')).toBe('2 rotis');
    expect(joinSaid('dal, ', '2 rotis')).toBe('dal, 2 rotis');
    expect(joinSaid('dal', '')).toBe('dal');
  });

  it('says why it could not listen, and the keyboard mic that always works', () => {
    expect(speechProblem('not-allowed')).toMatch(/keyboard/);
    expect(speechProblem('service-not-allowed')).toMatch(/keyboard/);
    expect(speechProblem('no-speech')).toMatch(/Nothing was heard/);
    expect(speechProblem('weird')).toMatch(/keyboard/);
  });
});

describe('listening through pauses', () => {
  /** A stand-in for the phone's recognition: the test decides what each session hears. */
  function fake() {
    const sessions: (SpeechRecognitionLike & { started: boolean; stopped: boolean })[] = [];
    class Speech {
      lang = '';
      interimResults = false;
      continuous = true;
      maxAlternatives = 1;
      started = false;
      stopped = false;
      onresult: SpeechRecognitionLike['onresult'] = null;
      onend: SpeechRecognitionLike['onend'] = null;
      onerror: SpeechRecognitionLike['onerror'] = null;
      constructor() {
        sessions.push(this as never);
      }
      start() {
        this.started = true;
      }
      stop() {
        this.stopped = true;
        this.onend?.();
      }
      abort() {
        this.stopped = true;
      }
    }
    return { Speech: Speech as unknown as new () => SpeechRecognitionLike, sessions };
  }
  const hear = (s: SpeechRecognitionLike, words: string, alt?: string) =>
    s.onresult?.({ results: [{ 0: { transcript: words }, ...(alt ? { 1: { transcript: alt } } : {}), length: alt ? 2 : 1, isFinal: true }] as never });

  it('keeps listening after a short pause and joins what was said', () => {
    vi.useFakeTimers();
    const { Speech, sessions } = fake();
    const ended: [string, string[]][] = [];
    const texts: string[] = [];
    listenPatiently(Speech, {
      patienceMs: 3000,
      maxMs: 20_000,
      onText: (f) => texts.push(f),
      onEnd: (f, a) => ended.push([f, a]),
      onError: () => ended.push(['error', []]),
    });
    expect(sessions[0]).toMatchObject({ lang: 'en-IN', continuous: false, interimResults: true, started: true });
    hear(sessions[0]!, '80 kilo');
    // The phone stops at the pause; a new session starts by itself.
    sessions[0]!.onend?.();
    expect(sessions).toHaveLength(2);
    expect(ended).toEqual([]);
    vi.advanceTimersByTime(1500);
    hear(sessions[1]!, '8 reps', 'ate reps');
    expect(texts.at(-1)).toBe('80 kilo 8 reps');
    sessions[1]!.onend?.();
    // Quiet for longer than the patience: it ends with everything that was said.
    vi.advanceTimersByTime(3500);
    expect(ended).toEqual([['80 kilo 8 reps', ['80 kilo ate reps']]]);
    vi.useRealTimers();
  });

  it('ends at once when stopped, and says so when nothing was heard', () => {
    vi.useFakeTimers();
    const a = fake();
    const got: string[] = [];
    const l = listenPatiently(a.Speech, { patienceMs: 3000, maxMs: 20_000, onText: () => {}, onEnd: (f) => got.push(f), onError: (c) => got.push(`error:${c}`) });
    hear(a.sessions[0]!, 'dal rice');
    l.stop();
    expect(got).toEqual(['dal rice']);
    expect(a.sessions).toHaveLength(1);

    const b = fake();
    listenPatiently(b.Speech, { patienceMs: 3000, maxMs: 20_000, onText: () => {}, onEnd: (f) => got.push(f), onError: (c) => got.push(`error:${c}`) });
    b.sessions[0]!.onerror?.({ error: 'no-speech' });
    b.sessions[0]!.onend?.();
    vi.advanceTimersByTime(7000);
    expect(got.at(-1)).toBe('error:no-speech');

    const c = fake();
    listenPatiently(c.Speech, { patienceMs: 3000, maxMs: 20_000, onText: () => {}, onEnd: (f) => got.push(f), onError: (c2) => got.push(`error:${c2}`) });
    c.sessions[0]!.onerror?.({ error: 'not-allowed' });
    c.sessions[0]!.onend?.();
    expect(got.at(-1)).toBe('error:not-allowed');
    expect(c.sessions).toHaveLength(1);
    vi.useRealTimers();
  });
});
