import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAccount } from '@/app/account';
import { BrandMark } from '@/app/layout/BrandMark';
import { GUIDES } from '@/app/marketing';
import { APP_NAME } from '@/app/navigation';
import { usePageMeta } from '@/app/usePageMeta';
import { LegalLinks } from '@/features/legal/LegalPage';

/**
 * The frame of a public page anyone can read without an account (the science page and the
 * guides): the logo, a way into the app, and links to the other public pages. Signed in, the
 * way back leads to the app; signed out, to creating an account.
 */
export function PublicFrame({
  path,
  width = 'max-w-3xl',
  children,
}: {
  path: string;
  width?: string;
  children: ReactNode;
}) {
  usePageMeta(path);
  const account = useAccount();
  const signedIn = account.status === 'signedIn' || account.status === 'unavailable';
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [path]);

  return (
    <div className="min-h-dvh bg-bg">
      <header className={`mx-auto flex ${width} items-center justify-between gap-3 px-4 pt-safe pb-2`}>
        <Link to="/" className="chrome tap-target flex items-center gap-2 rounded-field">
          <BrandMark className="size-8" />
          <span className="type-headline text-text-1">{APP_NAME}</span>
        </Link>
        {signedIn ? (
          <Link to="/" className="chrome tap-target type-meta rounded-field text-text-2 underline">
            Open the app
          </Link>
        ) : (
          <Link
            to="/sign-up"
            className="pressable chrome inline-flex h-9 items-center rounded-full bg-lime px-4 type-meta font-semibold text-on-lime"
          >
            Start free
          </Link>
        )}
      </header>
      <main id="main" className={`mx-auto ${width} px-4 pt-6 pb-12`}>
        {children}
      </main>
      <footer className={`mx-auto ${width} border-t-[0.5px] border-divider px-4 pt-5 pb-10`}>
        <nav aria-label="Guides" className="type-meta mb-2 flex flex-wrap gap-x-4 gap-y-1">
          {GUIDES.map((g) => (
            <Link key={g.path} to={g.path} className="chrome rounded-field text-text-2 underline">
              {g.heading}
            </Link>
          ))}
          <Link to="/science" className="chrome rounded-field text-text-2 underline">
            The science
          </Link>
        </nav>
        <LegalLinks />
        <p className="type-caption mt-3 text-text-2">{APP_NAME} is run by Anish Verma, India.</p>
      </footer>
    </div>
  );
}
