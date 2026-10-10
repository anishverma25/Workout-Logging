import { Link } from 'react-router';
import { Info } from 'lucide-react';

/**
 * The 24px info button beside a section title (D6): opens the part of "How every number is
 * calculated" that explains the section. Neutral, never lime.
 */
export function EvidenceLink({ topic, about }: { topic: string; about: string }) {
  return (
    <Link
      to={`/science#${topic}`}
      aria-label={`About ${about}`}
      title={`How ${about} is calculated`}
      className="pressable tap-target inline-flex size-6 shrink-0 items-center justify-center rounded-full text-text-2 hover:text-text-1"
    >
      <Info className="size-5" strokeWidth={1.75} aria-hidden />
    </Link>
  );
}
