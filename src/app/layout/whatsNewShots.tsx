import feed from '@/assets/release/community-feed.jpg';
import ask from '@/assets/release/community-ask.jpg';
import answer from '@/assets/release/community-answer.jpg';
import karma from '@/assets/release/community-karma.jpg';
import meals from '@/assets/release/food-meal-macros.jpg';

/**
 * Real screens of the release (Community launch, November 2026), taken from the app with sample
 * members, shown in a phone-like frame with a soft lime glow. The pictures are part of the build,
 * so they show at once, also offline.
 */
function Shot({ src, alt, height = 22 }: { src: string; alt: string; height?: number }) {
  return (
    <div className="relative mx-auto w-full max-w-[20rem]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 -bottom-4 h-16 rounded-full bg-lime/20 blur-2xl"
      />
      <div
        className="relative overflow-hidden rounded-[1.75rem] bg-black shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)] ring-1 ring-white/12"
        style={{ height: `${height}rem` }}
      >
        <img
          src={src}
          alt={alt}
          width={600}
          decoding="async"
          className="block w-full object-cover object-top"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black to-transparent"
        />
      </div>
    </div>
  );
}

export const FeedShot = () => (
  <Shot src={feed} alt="The Community feed: questions and journeys from members, with topics" />
);
export const AskShot = () => (
  <Shot src={ask} alt="Asking a question with Post anonymously switched on" />
);
export const AnswerShot = () => (
  <Shot src={answer} alt="A question with a best answer from a Macrotrophy Verified creator" />
);
export const KarmaShot = () => (
  <Shot src={karma} alt="Karma: 185 of 300 toward 30 days of Macrotrophy Pro" />
);
export const MealsShot = () => (
  <Shot
    src={meals}
    alt="Breakfast with its calories and carbs, fat and protein in grams"
    height={15}
  />
);
