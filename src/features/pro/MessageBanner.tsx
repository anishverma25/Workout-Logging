import { useEffect, useState } from 'react';
import { Gift, X } from 'lucide-react';
import { useEntitlement } from '@/app/entitlement';
import { db } from '@/data/db';
import { getMeta, META_KEYS, setMeta } from '@/data/repositories/meta';
import { cn } from '@/lib/cn';

/**
 * A personal message from the team, on Home, for the one account it was set for (for example a
 * thank you to a milestone user). The server sends it only while it has not expired
 * (`get_my_subscription`). It is plain text, dismissible, and stays dismissed on this phone.
 *
 * Every failure here means "no banner": a server without the message, an unreadable local
 * store or an empty text can never block or break Home.
 */
export function MessageBanner({ className }: { className?: string }) {
  const { banner } = useEntitlement();
  // undefined: still reading what was dismissed. The banner waits, so it never flashes.
  const [dismissed, setDismissed] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    getMeta<string>(db, META_KEYS.dismissedBanner)
      .then((value) => {
        if (live) setDismissed(typeof value === 'string' ? value : null);
      })
      .catch(() => {
        if (live) setDismissed(null);
      });
    return () => {
      live = false;
    };
  }, []);

  if (!banner || dismissed === undefined || dismissed === banner) return null;

  return (
    <section
      aria-label="A message for you"
      data-testid="user-banner"
      className={cn('mb-4 rounded-card bg-surface p-4', className)}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lime-dim text-lime"
        >
          <Gift className="size-4" />
        </span>
        <p className="type-headline min-w-0 flex-1 text-text-1 [text-wrap:pretty]">{banner}</p>
        <button
          type="button"
          aria-label="Dismiss message"
          className="pressable tap-target -mr-1.5 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-text-2 hover:text-text-1"
          onClick={() => {
            setDismissed(banner);
            void setMeta(db, META_KEYS.dismissedBanner, banner).catch(() => undefined);
          }}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}
