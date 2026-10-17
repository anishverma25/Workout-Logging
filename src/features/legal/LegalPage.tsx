import { useEffect } from 'react';
import { Link } from 'react-router';
import { AtSign, Mail, MapPin } from 'lucide-react';
import { BrandMark } from '@/app/layout/BrandMark';
import { APP_NAME } from '@/app/navigation';
import { usePageMeta } from '@/app/usePageMeta';
import { cn } from '@/lib/cn';
import { CONTACT, LEGAL_DOCUMENTS, PRIVACY, REFUNDS, TERMS, type LegalDocument } from './documents';
import {
  LAST_UPDATED,
  OWNER_NAME,
  SUPPORT_EMAIL,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
} from './contact';

/** Small row of links to the four legal pages. Used in the page footer, More, Pro and sign up. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={cn('type-meta flex flex-wrap gap-x-4 gap-y-1', className)}>
      {LEGAL_DOCUMENTS.map((d) => (
        <Link key={d.slug} to={`/${d.slug}`} className="chrome rounded-field text-text-2 underline">
          {d.label}
        </Link>
      ))}
    </nav>
  );
}

function LegalLayout({ doc, children }: { doc: LegalDocument; children: React.ReactNode }) {
  usePageMeta(`/${doc.slug}`);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [doc]);

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 pt-safe pb-2">
        <Link to="/" className="chrome tap-target flex items-center gap-2 rounded-field">
          <BrandMark className="size-8" />
          <span className="type-headline text-text-1">{APP_NAME}</span>
        </Link>
        <Link to="/" className="chrome tap-target type-meta rounded-field text-text-2 underline">
          Open the app
        </Link>
      </header>
      <main id="main" className="mx-auto max-w-2xl px-4 pt-6 pb-12">
        <h1 className="type-display text-text-1">{doc.title}</h1>
        <p className="type-meta tabular mt-2 text-text-2">Last updated {LAST_UPDATED}</p>
        {children}
      </main>
      <footer className="mx-auto max-w-2xl border-t border-border px-4 pt-5 pb-10">
        <LegalLinks />
        <p className="type-caption mt-3 text-text-2">
          {APP_NAME} is run by {OWNER_NAME}, India.
        </p>
      </footer>
    </div>
  );
}

function Sections({ doc }: { doc: LegalDocument }) {
  return (
    <div className="mt-8 flex flex-col gap-8">
      {doc.sections.map((s) => (
        <section key={s.heading} aria-labelledby={`h-${slug(s.heading)}`}>
          <h2 id={`h-${slug(s.heading)}`} className="type-title text-text-1">
            {s.heading}
          </h2>
          {s.paragraphs?.map((p) => (
            <p key={p} className="type-body mt-2 text-text-2">
              {p}
            </p>
          ))}
          {s.items ? (
            <ul className="type-body mt-2 flex list-disc flex-col gap-1.5 pl-5 text-text-2 marker:text-text-3">
              {s.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function DocumentPage({ doc }: { doc: LegalDocument }) {
  return (
    <LegalLayout doc={doc}>
      <p className="type-body mt-3 text-text-2">{doc.summary}</p>
      <Sections doc={doc} />
    </LegalLayout>
  );
}

export const TermsPage = () => <DocumentPage doc={TERMS} />;
export const PrivacyPage = () => <DocumentPage doc={PRIVACY} />;
export const RefundsPage = () => <DocumentPage doc={REFUNDS} />;

export function ContactPage() {
  return (
    <LegalLayout doc={CONTACT}>
      <p className="type-body mt-3 text-text-2">{CONTACT.summary}</p>
      <ul className="mt-6 flex flex-col gap-3 rounded-panel border border-border bg-surface p-4">
        <li className="flex items-start gap-3">
          <MapPin className="mt-0.5 size-5 shrink-0 text-text-2" aria-hidden />
          <span>
            <span className="type-meta block text-text-2">Run by</span>
            <span className="type-headline block text-text-1">{OWNER_NAME}, India</span>
          </span>
        </li>
        <li className="flex items-start gap-3">
          <Mail className="mt-0.5 size-5 shrink-0 text-text-2" aria-hidden />
          <span>
            <span className="type-meta block text-text-2">Email</span>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="type-headline block text-text-1 underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </span>
        </li>
        <li className="flex items-start gap-3">
          <AtSign className="mt-0.5 size-5 shrink-0 text-text-2" aria-hidden />
          <span>
            <span className="type-meta block text-text-2">Instagram</span>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="type-headline block text-text-1 underline"
            >
              {INSTAGRAM_HANDLE}
            </a>
          </span>
        </li>
      </ul>
      <Sections doc={CONTACT} />
    </LegalLayout>
  );
}
