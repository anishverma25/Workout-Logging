import { CalendarCheck, ChartNoAxesColumnIncreasing, Crown, Medal, Target } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useEntitlement } from '@/app/entitlement';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { db } from '@/data/db';
import { useFoundingWelcomed } from '@/data/hooks';
import { META_KEYS, setMeta } from '@/data/repositories/meta';

const HIGHLIGHTS = [
  { icon: Medal, text: 'Strength levels and your DOTS score' },
  { icon: CalendarCheck, text: 'A weekly check-in with one thing to focus on' },
  { icon: Target, text: 'When you will reach each goal at your current pace' },
  { icon: ChartNoAxesColumnIncreasing, text: 'All-time trends, plateaus and balance ratios' },
];

/** Shown once per account, the first time it opens during early access. */
export function FoundingWelcome() {
  const entitlement = useEntitlement();
  const welcomed = useFoundingWelcomed();
  const navigate = useNavigate();
  const open = entitlement.plan === 'founding' && welcomed.status === 'success' && !welcomed.data;

  const close = async (to?: string) => {
    await setMeta(db, META_KEYS.foundingWelcomed, true);
    if (to) navigate(to);
  };

  return (
    <Sheet open={open} onClose={() => void close()} title="Welcome, founding member">
      <div className="flex flex-col items-start gap-4">
        <span className="flex size-14 items-center justify-center rounded-[1.1rem] bg-gradient-to-br from-[var(--tile-iris)] to-[var(--tile-plum)] text-white">
          <Crown className="size-7" aria-hidden />
        </span>
        <p className="text-[1.02rem] leading-relaxed text-muted">
          You are part of Overload&rsquo;s{' '}
          <strong className="text-text">exclusive early access</strong>: a small group who get in
          before anyone else. Every Pro feature is already unlocked on your account, free, for as
          long as early access lasts.
        </p>
        <ul className="flex w-full flex-col gap-3 rounded-[1.1rem] bg-surface-2 p-4">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[0.95rem]">
              <Icon className="size-5 shrink-0 text-accent-text" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
        <p className="text-sm text-faint">
          Your feedback shapes what everyone else gets later. Tell us what you would change.
        </p>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button block onClick={() => void close('/pro')}>
            See everything unlocked
          </Button>
          <Button block variant="secondary" onClick={() => void close()}>
            Start training
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
