import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { ExternalLink } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Tex } from '@/components/ui/Tex';
import {
  CITATIONS,
  METRIC_EVIDENCE,
  citationUrl,
  type Citation,
} from '@/domain/analytics/citations';
import { cn } from '@/lib/cn';
import { SCIENCE, type Topic } from './topics';

/**
 * The science behind every number: what the app shows, the formula, why it is done that way,
 * what it means for you, the limits, and the papers with links. Reached from the top of
 * Progress, from the info links beside numbers, and from More.
 */
export function SciencePage() {
  const { hash } = useLocation();
  // Lazy routes render after the browser tried to scroll to the hash, so scroll once loaded.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <PageHeader
        title="The science"
        subtitle="Every number in Overload, the formula behind it and the research it rests on. Read a section, follow a source, and judge it for yourself."
      />

      <Card className="mb-6 p-5">
        <p className="leading-relaxed text-muted">
          Numbers come from the sets you log, run through fixed formulas. Nothing is guessed by AI
          and nothing is invented to fill a chart; when there is not enough data, the app says so.
          Each section is marked <Kind kind="evidence" /> when it rests on published research, or{' '}
          <Kind kind="definition" /> when it is plain arithmetic about your own log, which needs no
          paper.
        </p>
      </Card>

      <nav aria-label="On this page" className="mb-8 flex flex-col gap-4">
        {SCIENCE.map((g) => (
          <div key={g.id}>
            <p className="mb-2 text-sm font-semibold text-faint">{g.title}</p>
            <div className="flex flex-wrap gap-2 text-sm">
              {g.topics.map((t) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  className="rounded-full bg-surface px-3 py-1.5 font-medium text-muted hover:text-text"
                >
                  {t.title}
                </a>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {SCIENCE.map((g) => (
        <section key={g.id} aria-labelledby={`group-${g.id}`} className="mb-10">
          <h2 id={`group-${g.id}`} className="mb-3 px-1 font-display text-[1.6rem] font-bold">
            {g.title}
          </h2>
          <div className="flex flex-col gap-4">
            {g.topics.map((t) => (
              <TopicCard key={t.id} topic={t} />
            ))}
          </div>
        </section>
      ))}

      <p className="px-1 text-xs leading-relaxed text-faint">
        Links go to each paper&apos;s DOI or publisher page. Some are open access; others show the
        abstract with the full text behind the journal&apos;s paywall. Formulas are estimates for
        healthy adults and are not medical advice.
      </p>
    </div>
  );
}

function TopicCard({ topic }: { topic: Topic }) {
  const ev = topic.evidence ? METRIC_EVIDENCE[topic.evidence] : undefined;
  const sources = (ev?.citations ?? [])
    .map((id) => CITATIONS[id])
    .filter((c): c is Citation => !!c);
  return (
    <Card id={topic.id} className="scroll-mt-20 p-5" aria-labelledby={`${topic.id}-title`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${topic.id}-title`} className="font-display text-[1.3rem] font-bold">
          {topic.title}
        </h3>
        <Kind kind={ev?.kind ?? 'rule'} />
      </div>
      <p className="mt-1.5 leading-relaxed text-muted">{topic.shows}</p>

      {topic.formulas?.length ? (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          {topic.formulas.map((f) => (
            <div key={f.tex}>
              <Tex label={f.spoken}>{f.tex}</Tex>
              {f.where ? <p className="text-xs leading-relaxed text-faint">{f.where}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {topic.why?.length ? (
        <Part title={ev?.kind === 'evidence' ? 'Why this way' : 'How it works'}>
          <ul className="flex flex-col gap-2">
            {topic.why.map((w, i) => (
              <li
                key={i}
                className="relative pl-4 before:absolute before:left-0 before:top-[0.6em] before:size-1.5 before:rounded-full before:bg-[var(--ring-1)]"
              >
                {w}
              </li>
            ))}
          </ul>
        </Part>
      ) : null}

      {topic.forYou ? <Part title="What it means for you">{topic.forYou}</Part> : null}
      {topic.limits ? (
        <p className="mt-4 border-l-2 border-warn/50 pl-3 text-sm text-faint">{topic.limits}</p>
      ) : null}

      {sources.length ? (
        <Part title={sources.length === 1 ? 'Source' : 'Sources'}>
          <ol className="flex flex-col gap-2.5">
            {sources.map((c) => (
              <Source key={c.id} c={c} />
            ))}
          </ol>
        </Part>
      ) : null}
    </Card>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h4 className="mb-1.5 text-sm font-semibold">{title}</h4>
      <div className="leading-relaxed text-muted">{children}</div>
    </div>
  );
}

function Source({ c }: { c: Citation }) {
  const url = citationUrl(c);
  const authors = c.authors.split(',');
  const lead = authors.length > 2 ? `${authors[0]} et al.` : c.authors;
  return (
    <li className="text-sm">
      <span className="text-text">{c.title}</span>
      <span className="block text-xs text-faint">
        {lead}
        {c.year ? `, ${c.year}` : ''}. {c.journal}.{c.openAccess ? ' Open access.' : ''}
      </span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-accent-text"
        >
          {c.doi ? `doi.org/${c.doi}` : new URL(url).host}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      ) : null}
    </li>
  );
}

function Kind({ kind }: { kind: 'evidence' | 'definition' | 'rule' }) {
  const label =
    kind === 'evidence' ? 'Evidence' : kind === 'definition' ? 'Definition' : 'App rule';
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold',
        kind === 'evidence' ? 'bg-accent-soft text-accent-text' : 'bg-surface-2 text-muted',
      )}
    >
      {label}
    </span>
  );
}
