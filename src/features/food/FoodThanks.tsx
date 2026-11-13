import { useEffect, useState } from 'react';
import { HeartHandshake, X } from 'lucide-react';
import {
  fetchFoodThanks,
  markThanked,
  unthanked,
  type FoodThanks as Thanks,
} from '@/app/sharedFoods';
import { IconButton } from '@/components/kit';
import { formatCalendarDate } from '@/lib/format';

/**
 * A thank-you, shown once on this phone after a food the person suggested was checked and added
 * for everyone. The 5% is mentioned here and nowhere else: it is a thank-you, not an offer, so
 * nothing in the app asks people to add foods for it. It is applied at payment by itself.
 */
export function FoodThanks() {
  const [thanks, setThanks] = useState<Thanks | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchFoodThanks().then((t) => {
      if (alive) setThanks(t);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!thanks || hidden) return null;
  const fresh = unthanked(thanks);
  if (fresh.length === 0) return null;
  const names = fresh.map((f) => f.name);
  const which =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

  return (
    <section
      aria-labelledby="food-thanks-title"
      className="glow-lime relative overflow-hidden rounded-card bg-surface p-4 pr-12"
      data-food-thanks
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lime-dim text-lime"
        >
          <HeartHandshake className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="food-thanks-title" className="type-headline text-text-1">
            Thank you for improving the food library
          </h2>
          <p className="type-subhead mt-1 text-text-2">
            {which} {fresh.length === 1 ? 'is' : 'are'} now in search for everyone, checked against
            the label. It makes Macrotrophy better for every Indian lifter.
          </p>
          {thanks.credit ? (
            <p className="type-subhead mt-2 text-text-1" data-food-thanks-credit>
              As our thanks, your next Pro payment is {thanks.credit.percent}% less, until{' '}
              {formatCalendarDate(new Date(`${thanks.credit.validUntil}T12:00:00`))}. Nothing to
              type: it is taken off by itself.
            </p>
          ) : null}
        </div>
      </div>
      <IconButton
        label="Close"
        icon={<X className="size-4" aria-hidden />}
        className="absolute top-2 right-2"
        onClick={() => {
          markThanked(fresh.map((f) => f.id));
          setHidden(true);
        }}
      />
    </section>
  );
}
