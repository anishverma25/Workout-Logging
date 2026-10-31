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
      return 'The microphone is not allowed for Overload here. Tap the mic on your keyboard and speak instead, or allow the microphone in your phone settings.';
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
