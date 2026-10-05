import { ChartNoAxesColumnIncreasing, Crown, Dumbbell, Scale } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { PlannedFeature } from './shared/PlannedFeature';
import { PageHeader } from '@/app/layout/PageHeader';

export function WorkoutPage() {
  return (
    <PlannedFeature
      title="Workout"
      subtitle="Log sets faster than typing them into Notes"
      icon={<Dumbbell className="size-5" aria-hidden />}
      points={[
        'Start from today’s routine day or an empty workout',
        'See last time’s sets next to every exercise, and copy them in one tap',
        'Log weight, reps and effort with a keyboard-friendly number pad',
        'Built-in rest timer with 60, 90, 120 and 180 second presets',
        'Your workout is saved on the device as you go, so a refresh or lost signal loses nothing',
      ]}
    />
  );
}

export function ProgressPage() {
  return (
    <PlannedFeature
      title="Progress"
      subtitle="Strength, volume and consistency over time"
      icon={<ChartNoAxesColumnIncreasing className="size-5" aria-hidden />}
      points={[
        'Estimated 1RM, load and rep progression per exercise',
        'Weekly volume load and working sets per muscle group',
        'Training frequency and adherence to your plan',
        '7, 30, 90 day and all-time ranges',
        'A methodology page explaining exactly how every number is calculated',
      ]}
    />
  );
}

export function BodyPage() {
  return (
    <PlannedFeature
      title="Body metrics"
      subtitle="Body weight, measured honestly"
      icon={<Scale className="size-5" aria-hidden />}
      points={[
        'Quick daily weigh-ins in kg or lb',
        'Trend line and 7-day rolling average, once there is enough data',
        'Relative strength: estimated 1RM divided by body weight',
      ]}
    >
      <ButtonLink to="/" variant="secondary" size="sm">
        Your latest weigh-in is on Home
      </ButtonLink>
    </PlannedFeature>
  );
}

export function ProPage() {
  return (
    <PlannedFeature
      title="Pro"
      subtitle="Deeper analytics, same honest numbers"
      icon={<Crown className="size-5" aria-hidden />}
      points={[
        'A 7-day free trial with full access',
        'Advanced comparisons, detailed trends and reports',
        'Simple UPI payment. Your workout history always stays yours, Pro or not',
      ]}
    />
  );
}

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" subtitle="That link does not go anywhere in the app." />
      <ButtonLink to="/">Go to Home</ButtonLink>
    </>
  );
}
