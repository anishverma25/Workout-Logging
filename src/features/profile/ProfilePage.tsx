import { useState, type FormEvent } from 'react';
import { Pencil, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chips, TextField } from '@/components/ui/Fields';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { ProfileError, saveProfile } from '@/data/repositories/profile';
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
  const [editing, setEditing] = useState(false);
  // The demo profile is fictional and read only; editing creates the person's own.
  const editable = profile && profile.origin !== 'demo' ? profile : null;

  return (
    <>
      <PageHeader
        title="Profile"
        subtitle="Your name, goal and experience. Used to greet you and to label your training."
      />
      <Sheet open={editing} onClose={() => setEditing(false)} title="Your profile">
        {editing ? <ProfileForm initial={editable} onDone={() => setEditing(false)} /> : null}
      </Sheet>
      {training.status === 'loading' ? <Skeleton className="h-48 max-w-2xl" /> : null}
      {training.status === 'error' ? <ErrorState error={training.error} /> : null}
      {training.status === 'success' && !profile ? (
        <EmptyState
          icon={<UserRound className="size-5" aria-hidden />}
          title="No profile yet"
          body="Your name, goal and experience level. Add them so the app knows who it is talking to."
          actions={<Button onClick={() => setEditing(true)}>Set up profile</Button>}
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
            <Button
              size="sm"
              variant="secondary"
              className="ml-auto self-start"
              icon={<Pencil className="size-4" aria-hidden />}
              onClick={() => setEditing(true)}
            >
              {editable ? 'Edit' : 'Set up yours'}
            </Button>
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

const GOAL_OPTIONS = (Object.keys(GOALS) as Profile['goal'][]).map((value) => ({
  value,
  label: GOALS[value],
}));
const EXPERIENCE_OPTIONS = (Object.keys(EXPERIENCE) as Profile['experience'][]).map((value) => ({
  value,
  label: EXPERIENCE[value],
}));

function ProfileForm({ initial, onDone }: { initial: Profile | null; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(initial?.displayName ?? '');
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '');
  const [goal, setGoal] = useState<Profile['goal']>(initial?.goal ?? 'strength_hypertrophy');
  const [experience, setExperience] = useState<Profile['experience']>(
    initial?.experience ?? 'beginner',
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveProfile(db, { displayName: name, birthDate: birthDate || null, goal, experience });
      toast('Profile saved');
      onDone();
    } catch (err) {
      setError(err instanceof ProfileError ? err.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      <TextField
        label="Name"
        autoComplete="given-name"
        maxLength={60}
        required
        value={name}
        error={error}
        onChange={(e) => setName(e.target.value)}
      />
      <TextField
        label="Birth date"
        type="date"
        hint="Optional. Only used to show your age."
        value={birthDate}
        onChange={(e) => setBirthDate(e.target.value)}
      />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted">Goal</p>
        <Chips
          label="Goal"
          options={GOAL_OPTIONS}
          value={goal}
          onChange={(v) => v && setGoal(v)}
          className="sm:flex-wrap"
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted">Experience</p>
        <Chips
          label="Experience"
          options={EXPERIENCE_OPTIONS}
          value={experience}
          onChange={(v) => v && setExperience(v)}
        />
      </div>
      <Button type="submit" size="lg" block disabled={busy}>
        {busy ? 'Saving...' : 'Save profile'}
      </Button>
    </form>
  );
}
