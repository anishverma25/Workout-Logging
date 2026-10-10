import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { PageHeader } from '@/app/layout/PageHeader';
import { ChevronRight } from 'lucide-react';
import { Badge, Card, TextLink } from '@/components/kit';
import { Tex } from '@/components/ui/Tex';
import {
  CITATIONS,
  METRIC_EVIDENCE,
  citationUrl,
  type Citation,
} from '@/domain/analytics/citations';
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
        back={{ to: '/more', label: 'More' }}
        title="How every number is calculated"
        subtitle="Every number in Overload, the formula behind it and the research it rests on. Read a section, follow a source, and judge it for yourself."
      />

      <Card className="mb-6">
        <p className="type-body text-text-2">
          Numbers come from the sets you log, run through fixed formulas. Nothing is guessed by AI
          and nothing is invented to fill a chart; when there is not enough data, the app says so.
          Each section is marked <Kind kind="evidence" /> when it rests on published research, or{' '}
          <Kind kind="definition" /> when it is plain arithmetic about your own log, which needs no
          paper.
        </p>
      </Card>

      <nav aria-label="On this page" className="mb-8">
        <Card flush>
          {SCIENCE.map((g) => (
            <div
              key={g.id}
              className="px-4 pt-3 pb-1 not-first:border-t-[0.5px] not-first:border-divider"
            >
              <p className="type-meta font-semibold text-text-2">{g.title}</p>
              <ul className="divide-y-[0.5px] divide-divider">
                {g.topics.map((t) => (
                  <li key={t.id}>
                    <a
                      href={`#${t.id}`}
                      className="pressable chrome flex min-h-11 items-center gap-3 rounded-field py-2"
                    >
                      <span className="type-headline min-w-0 flex-1 truncate font-medium text-text-1">
                        {t.title}
                      </span>
                      <ChevronRight className="size-5 shrink-0 text-text-3" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      </nav>

      {SCIENCE.map((g) => (
        <section key={g.id} aria-labelledby={`group-${g.id}`} className="mb-8">
          <h2 id={`group-${g.id}`} className="type-title mb-3 px-1 text-text-1">
            {g.title}
          </h2>
          <div className="flex flex-col gap-4">
            {g.topics.map((t) => (
              <TopicCard key={t.id} topic={t} />
            ))}
          </div>
        </section>
      ))}

      <p className="type-meta px-1 text-text-2">
        Links go to each paper&apos;s DOI or publisher page. Some are open access; others show the
        abstract with the full text behind the journal&apos;s paywall. Formulas are estimates for
        healthy adults and are not medical advice.
      </p>
    </div>
  );
}

function TopicCard({ topic }: { topic: Topic }) {
  const ev = topic.evidence ? METRIC_EVIDENCE[topic.evidence] : undefined;
  const kind = ev?.kind ?? 'rule';
  const sources = (ev?.citations ?? [])
    .map((id) => CITATIONS[id])
    .filter((c): c is Citation => !!c);
  return (
    <Card as="section" id={topic.id} className="scroll-mt-20" aria-labelledby={`${topic.id}-title`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${topic.id}-title`} className="type-title text-text-1">
          {topic.title}
        </h3>
        <Kind kind={kind} />
      </div>
      <div className="type-body mt-2 text-text-1">{topic.shows}</div>

      {topic.formulas?.length ? (
        <div className="type-body tabular mt-4 flex flex-col gap-3 rounded-nested bg-surface-2 px-4 py-3 text-text-1">
          {topic.formulas.map((f) => (
            <div key={f.tex}>
              <Tex label={f.spoken}>{f.tex}</Tex>
              {f.where ? <p className="type-meta mt-1 text-text-2">{f.where}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {topic.why?.length ? (
        <Part title={kind === 'evidence' ? 'Why this way' : 'How it works'}>
          <ul className="flex flex-col gap-2 text-text-2">
            {topic.why.map((w, i) => (
              <li
                key={i}
                className="relative pl-4 before:absolute before:top-[0.6em] before:left-0 before:size-1.5 before:rounded-full before:bg-text-3"
              >
                {w}
              </li>
            ))}
          </ul>
        </Part>
      ) : null}

      {topic.forYou ? <Part title="What it means for you">{topic.forYou}</Part> : null}
      {topic.limits ? (
        <Part title="Limits">
          <div className="type-meta text-text-2">{topic.limits}</div>
        </Part>
      ) : null}

      {sources.length ? (
        <Part title={sources.length === 1 ? 'Source' : 'Sources'}>
          <ol className="flex flex-col gap-3">
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
    <div className="mt-5">
      <h4 className="type-headline mb-1.5 text-text-1">{title}</h4>
      <div className="type-body text-text-1">{children}</div>
    </div>
  );
}

function Source({ c }: { c: Citation }) {
  const url = citationUrl(c);
  const authors = c.authors.split(',');
  const lead = authors.length > 2 ? `${authors[0]} et al.` : c.authors;
  return (
    <li>
      <span className="type-body block text-text-1">{c.title}</span>
      <span className="type-meta block text-text-2">
        {lead}
        {c.year ? `, ${c.year}` : ''}. {c.journal}.{c.openAccess ? ' Open access.' : ''}
      </span>
      {url ? (
        <TextLink href={url} small className="-ml-0.5 break-all">
          {c.doi ? `doi.org/${c.doi}` : new URL(url).host}
        </TextLink>
      ) : null}
    </li>
  );
}

function Kind({ kind }: { kind: 'evidence' | 'definition' | 'rule' }) {
  const label =
    kind === 'evidence' ? 'Evidence' : kind === 'definition' ? 'Definition' : 'App rule';
  return <Badge tone={kind === 'evidence' ? 'lime' : 'neutral'}>{label}</Badge>;
}
