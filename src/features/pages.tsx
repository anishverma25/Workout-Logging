import { ChartNoAxesColumnIncreasing, Crown } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { PlannedFeature } from './shared/PlannedFeature';
import { PageHeader } from '@/app/layout/PageHeader';

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
