import { UserRound } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { bodyWeightSummary } from '@/domain/analytics/bodyweight';
import type { Profile } from '@/domain/models/schemas';
import { usePreferences, useTrainingData } from '@/data/hooks';
import { ageFromBirthDate } from '@/lib/dates';
import { formatWeight } from '@/lib/units';

const GOALS: Record<Profile['goal'], string> = {
  strength: 'Strength',
  hypertrophy: 'Muscle growth',
  strength_hypertrophy: 'Strength and muscle growth',
  general_fitness: 'General fitness',
};
const EXPERIENCE: Record<Profile['experience'], string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export function ProfilePage() {
  const training = useTrainingData();
  const prefs = usePreferences();
  const profile = training.data?.profile;
  const bw = training.data ? bodyWeightSummary(training.data.bodyWeights) : null;

  return (
    <>
      <PageHeader title="Profile" subtitle="Editing your profile arrives with accounts." />
      {training.status === 'loading' ? <Skeleton className="h-48 max-w-2xl" /> : null}
      {training.status === 'error' ? <ErrorState error={training.error} /> : null}
      {training.status === 'success' && !profile ? (
        <EmptyState
          icon={<UserRound className="size-5" aria-hidden />}
          title="No profile yet"
          body="Your name, goal and experience level help tailor suggestions. You will set these up when accounts arrive."
        />
      ) : null}
      {profile ? (
        <Card className="max-w-2xl p-5">
          <div className="flex items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-full bg-accent font-display text-2xl font-bold text-accent-ink">
              {profile.displayName
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div>
              <p className="font-display text-3xl font-bold leading-none">{profile.displayName}</p>
              {profile.origin === 'demo' ? (
                <p className="mt-1.5 text-sm text-warn">Fictional demo profile</p>
              ) : null}
            </div>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4">
            <Field
              label="Age"
              value={profile.birthDate ? String(ageFromBirthDate(profile.birthDate)) : 'Not set'}
            />
            <Field
              label="Body weight"
              value={bw ? formatWeight(bw.latest.weightKg, prefs.weightUnit) : 'Not logged'}
            />
            <Field label="Goal" value={GOALS[profile.goal]} />
            <Field label="Experience" value={EXPERIENCE[profile.experience]} />
          </dl>
        </Card>
      ) : null}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-faint">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
