import { Link } from 'react-router';
import { FlaskConical } from 'lucide-react';

/** A small link beside a number's heading to the section of the science page that explains it. */
export function EvidenceLink({ topic, about }: { topic: string; about: string }) {
  return (
    <Link
      to={`/science#${topic}`}
      aria-label={`The science behind ${about}`}
      className="tap-target inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-surface px-2.5 text-xs font-semibold text-accent-text"
    >
      <FlaskConical className="size-3.5" aria-hidden />
      Evidence
    </Link>
  );
}
