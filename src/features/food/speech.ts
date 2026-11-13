/** Speaking a meal: the phone's speech recognition, and what to say when it cannot listen. */

export interface SpeechResultLike {
  isFinal?: boolean;
  0?: { transcript: string };
  length: number;
}

export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex?: number; results: ArrayLike<SpeechResultLike> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}

export function speechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    (new () => SpeechRecognitionLike) | null;
}

/** What was said so far: the words the phone is sure of, and the ones still being heard. */
export function transcriptOf(results: ArrayLike<SpeechResultLike>): {
  final: string;
  interim: string;
} {
  let final = '';
  let interim = '';
  for (let i = 0; i < results.length; i += 1) {
    const r = results[i];
    const words = r?.[0]?.transcript ?? '';
    if (r?.isFinal) final += words;
    else interim += words;
  }
  return { final: final.replace(/\s+/g, ' ').trim(), interim: interim.replace(/\s+/g, ' ').trim() };
}

/** Plain words for why the phone could not listen, with the way that always works. */
export function speechProblem(code: string | undefined): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'The microphone is not allowed for Macrotrophy here. Tap the mic on your keyboard and speak instead, or allow the microphone in your phone settings.';
    case 'no-speech':
      return 'Nothing was heard. Tap the mic and speak, or use the mic on your keyboard.';
    case 'network':
      return 'Voice needs an internet connection. Type it, or use the mic on your keyboard.';
    case 'audio-capture':
      return 'No microphone was found. Use the mic on your keyboard instead.';
    default:
      return 'Voice did not work this time. Try again, or use the mic on your keyboard.';
  }
}

/** Joins what was just said to what is already in the box. */
export function joinSaid(text: string, said: string): string {
  const t = text.trim();
  if (!said) return t;
  return t ? `${t.replace(/[,\s]+$/, '')}, ${said}` : said;
}

export interface PatientOptions {
  /** How long a pause may last before listening ends by itself. */
  patienceMs: number;
  /** The longest it listens in one go. */
  maxMs: number;
  /** Everything said so far, and the words still being heard. */
  onText: (final: string, interim: string) => void;
  /** Listening is over: what was said, and other ways the last part may have been heard. */
  onEnd: (final: string, alternatives: string[]) => void;
  onError: (code: string | undefined) => void;
  now?: () => number;
}

/**
 * Listens through pauses. A phone's speech recognition stops at the first short silence, which
 * cuts people off mid-sentence ("80 kilo ... 8 reps", or a meal listed slowly). This keeps
 * starting it again until the person has been quiet for `patienceMs`, taps stop, or `maxMs`
 * passes, and joins what was heard. Each part is a fresh, non-continuous session, because
 * continuous mode repeats words on Android. Indian English (en-IN) is the voice that follows
 * Indian accents and Hinglish best of those phones offer.
 */
export function listenPatiently(
  Speech: new () => SpeechRecognitionLike,
  options: PatientOptions,
): { stop: () => void; abort: () => void } {
  const now = options.now ?? (() => Date.now());
  const started = now();
  let lastHeard = started;
  let heardAnything = false;
  let committed = '';
  let alternatives: string[] = [];
  let stopped = false;
  let finished = false;
  let fatal: string | undefined;
  let current: SpeechRecognitionLike | null = null;

  const join = (a: string, b: string) => [a, b].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(watch);
    current = null;
    if (fatal) options.onError(fatal);
    else if (!committed) options.onError(stopped && !heardAnything ? 'stopped' : 'no-speech');
    else options.onEnd(committed, alternatives);
  };
  const quietFor = () => now() - lastHeard;
  const over = () =>
    stopped ||
    !!fatal ||
    now() - started >= options.maxMs ||
    quietFor() >= (heardAnything ? options.patienceMs : options.patienceMs + 3000);

  const session = () => {
    let r: SpeechRecognitionLike;
    try {
      r = new Speech();
    } catch {
      fatal = fatal ?? 'unavailable';
      finish();
      return;
    }
    r.lang = 'en-IN';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 3;
    let sessionFinal = '';
    r.onresult = (e) => {
      const t = transcriptOf(e.results);
      if (t.final || t.interim) {
        lastHeard = now();
        heardAnything = true;
      }
      if (t.final && t.final !== sessionFinal) {
        sessionFinal = t.final;
        const last = e.results[e.results.length - 1] as unknown as ArrayLike<{ transcript?: string }> | undefined;
        alternatives = [];
        for (let i = 1; last && i < last.length; i += 1) {
          const words = last[i]?.transcript?.replace(/\s+/g, ' ').trim();
          if (words) alternatives.push(join(committed, words));
        }
      }
      options.onText(join(committed, t.final), t.interim);
    };
    r.onerror = (e) => {
      // Silence and stopping on purpose are how listening normally ends.
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      fatal = e.error ?? 'unknown';
    };
    r.onend = () => {
      if (finished) return;
      committed = join(committed, sessionFinal);
      if (over()) finish();
      else session();
    };
    current = r;
    try {
      r.start();
    } catch {
      fatal = fatal ?? 'unavailable';
      finish();
    }
  };

  const watch = setInterval(() => {
    if (!finished && over()) current?.stop();
  }, 250);
  session();
  return {
    stop: () => {
      stopped = true;
      current?.stop();
    },
    abort: () => {
      finished = true;
      clearInterval(watch);
      current?.abort();
    },
  };
}
