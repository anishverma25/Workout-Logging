import { Link, useLocation } from 'react-router';
import { guide } from '@/app/marketing';
import { GUIDE_ART as ART } from './guideArt';
import { HeaderArt } from './HeaderArt';
import { PublicFrame } from './PublicFrame';

/**
 * A guide for one thing people search for (src/app/marketing.ts). The build also writes it as
 * plain HTML into the page, so search engines read it before any script runs.
 */
export function GuidePage() {
  const { pathname } = useLocation();
  const g = guide(pathname.replace(/\/$/, ''));
  if (!g) return null;
  return (
    <PublicFrame path={g.path}>
      <article data-guide={g.path}>
        {ART[g.path] ? (
          <HeaderArt kind={ART[g.path]!.kind} caption={ART[g.path]!.caption} className="mb-6" />
        ) : null}
        <h1 className="type-display text-text-1">{g.heading}</h1>
        <p className="type-body mt-4 text-[1.0625rem] leading-relaxed text-text-2">{g.intro}</p>
        {g.sections.map((s) => (
          <section key={s.heading} className="mt-8">
            <h2 className="type-title text-text-1">{s.heading}</h2>
            {s.paragraphs?.map((p) => (
              <p key={p} className="type-body mt-3 text-text-2">
                {p}
              </p>
            ))}
            {s.points ? (
              <ul className="type-body mt-3 list-disc space-y-2 pl-5 text-text-2">
                {s.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
        <div className="mt-10 flex flex-col gap-3 rounded-panel bg-surface p-6 tab:flex-row tab:items-center tab:justify-between">
          <p className="type-headline text-text-1">Try it free, with 7 days of Pro.</p>
          <Link
            to="/sign-up"
            className="pressable chrome inline-flex h-12 items-center justify-center rounded-nested bg-lime px-6 type-headline text-on-lime"
          >
            Create free account
          </Link>
        </div>
      </article>
    </PublicFrame>
  );
}
