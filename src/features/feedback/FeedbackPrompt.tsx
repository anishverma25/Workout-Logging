import { MessageSquareHeart } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAccount } from '@/app/account';
import { markFeedbackPrompted, useFeedbackPrompted } from '@/app/feedback';
import { Button } from '@/components/ui/Button';
import { shouldAskForFeedback } from '@/domain/feedback/feedback';

/**
 * Asked once, on the summary of the third finished workout: after real use, at a good moment,
 * and never again whichever button is pressed.
 */
export function FeedbackPrompt({ finishedWorkouts }: { finishedWorkouts: number }) {
  const navigate = useNavigate();
  const signedIn = useAccount().status === 'signedIn';
  const prompted = useFeedbackPrompted();
  if (
    prompted.status !== 'success' ||
    !shouldAskForFeedback({ signedIn, finishedWorkouts, alreadyAsked: prompted.data })
  )
    return null;
  return (
    <section
      aria-labelledby="feedback-prompt-title"
      className="rise-in mt-4 flex flex-col gap-3 rounded-[var(--radius-card)] bg-surface p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[0.8rem] bg-[var(--tile-rose)] text-white">
          <MessageSquareHeart className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id="feedback-prompt-title" className="font-display text-xl font-semibold">
            Three workouts in. How is it going?
          </h2>
          <p className="mt-1 text-muted">
            You have used Overload enough to have an opinion. A rating and a line or two tell us
            what to build next.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="sm:flex-1"
          onClick={async () => {
            await markFeedbackPrompted();
            navigate('/feedback?from=prompt');
          }}
        >
          Give feedback
        </Button>
        <Button variant="ghost" className="sm:flex-1" onClick={() => void markFeedbackPrompted()}>
          Not now
        </Button>
      </div>
    </section>
  );
}
