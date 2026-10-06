import { useState, type FormEvent } from 'react';
import {
  Activity,
  CalendarDays,
  Cake,
  Dumbbell,
  Gauge,
  Pencil,
  Ruler,
  Scale,
  Sparkles,
  Target,
  Timer,
  UserRound,
  Users,
} from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Chips, TextField } from '@/components/ui/Fields';
import { NumberField } from '@/components/ui/NumberField';
import { Sheet } from '@/components/ui/Sheet';
import { ListGroup, ListRow } from '@/components/ui/List';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { ProfileError, saveProfile } from '@/data/repositories/profile';
import { PageHeader } from '@/app/layout/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States';
import { bodyWeightSummary } from '@/domain/analytics/bodyweight';
import type {
  DailyActivity,
  Experience,
  Goal,
  GymAccess,
  Profile,
  Sex,
} from '@/domain/models/schemas';
import {
  ACTIVITY_LABEL,
  EQUIPMENT_LABEL,
  EXPERIENCE_LABEL,
  GOAL_LABEL,
  SEX_LABEL,
} from '@/domain/models/labels';
import { usePreferences, useTrainingData } from '@/data/hooks';
import { ageFromBirthDate, toDateKey } from '@/lib/dates';
import { formatWeight } from '@/lib/units';
import { formatLength } from '@/features/body/format';

const NOT_SET = 'Not set';

export function ProfilePage() {
  const training = useTrainingData();
  const prefs = usePreferences();
  const profile = training.data?.profile;
  const bw = training.data ? bodyWeightSummary(training.data.bodyWeights) : null;
  const [editing, setEditing] = useState(false);
  // The demo profile is fictional and read only; editing creates the person's own.
  const editable = profile && profile.origin !== 'demo' ? profile : null;
  const initials = profile?.displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]!.toUpperCase())
    .slice(0, 2)
    .join('');
  const age = profile?.birthDate ? ageFromBirthDate(profile.birthDate) : null;

  return (
    <>
      <PageHeader title="Profile" />
      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit profile" size="lg">
        {editing ? <ProfileForm initial={editable} onDone={() => setEditing(false)} /> : null}
      </Sheet>
      {training.status === 'loading' ? <Skeleton className="h-48 max-w-2xl" /> : null}
      {training.status === 'error' ? <ErrorState error={training.error} /> : null}
      {training.status === 'success' && !profile ? (
        <EmptyState
          icon={<UserRound className="size-5" aria-hidden />}
          title="No profile yet"
          body="Your goal, experience and a few body details. They fit your routine, rep ranges and daily calories to you."
          actions={
            <>
              <ButtonLink to="/setup?next=/profile">Set up profile</ButtonLink>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Fill in a form instead
              </Button>
            </>
          }
        />
      ) : null}
      {profile ? (
        <div className="flex max-w-2xl flex-col gap-7">
          <section className="flex flex-col items-center rounded-[var(--radius-card)] bg-surface px-5 pb-5 pt-6 text-center">
            <span
              aria-hidden
              className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-[var(--tile-iris)] to-[var(--tile-plum)] font-display text-[1.75rem] font-semibold text-white"
            >
              {initials}
            </span>
            <p className="mt-3 font-display text-[1.5rem] font-bold leading-tight tracking-tight">
              {profile.displayName}
            </p>
            <p className="mt-0.5 text-sm text-faint">
              {GOAL_LABEL[profile.goal]}, {EXPERIENCE_LABEL[profile.experience].toLowerCase()}
            </p>
            {profile.origin === 'demo' ? (
              <p className="mt-1.5 text-sm text-warn">Fictional demo profile</p>
            ) : null}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={<Pencil className="size-4" aria-hidden />}
                onClick={() => setEditing(true)}
              >
                {editable ? 'Edit' : 'Set up yours'}
              </Button>
              <ButtonLink
                size="sm"
                variant="secondary"
                to="/setup?next=/profile"
                icon={<Sparkles className="size-4" aria-hidden />}
              >
                Run setup again
              </ButtonLink>
            </div>
          </section>

          <ListGroup
            title="Training"
            footer="Used to recommend a routine, set rep ranges, rest and sets, and size sessions."
          >
            <ListRow icon={Target} tone="lime" title="Goal" value={GOAL_LABEL[profile.goal]} />
            <ListRow
              icon={Gauge}
              tone="amber"
              title="Experience"
              value={EXPERIENCE_LABEL[profile.experience]}
            />
            <ListRow
              icon={CalendarDays}
              tone="ember"
              title="Days a week"
              value={profile.trainingDays ?? NOT_SET}
            />
            <ListRow
              icon={Timer}
              tone="iris"
              title="Session length"
              value={profile.sessionMinutes ? `${profile.sessionMinutes} min` : NOT_SET}
            />
            <ListRow
              icon={Dumbbell}
              tone="graphite"
              title="Equipment"
              value={profile.equipment ? EQUIPMENT_LABEL[profile.equipment] : NOT_SET}
            />
          </ListGroup>

          <ListGroup
            title="Body"
            footer="Used by the energy, BMI, body fat and strength formulas. Leave anything blank to skip the numbers that need it."
          >
            <ListRow
              icon={Users}
              tone="rose"
              title="Sex"
              value={profile.sex ? SEX_LABEL[profile.sex] : NOT_SET}
            />
            <ListRow icon={Cake} tone="plum" title="Age" value={age ?? NOT_SET} />
            <ListRow
              icon={Ruler}
              tone="sky"
              title="Height"
              value={profile.heightCm ? formatLength(profile.heightCm, prefs.lengthUnit) : NOT_SET}
            />
            <ListRow
              icon={Scale}
              tone="sky"
              title="Body weight"
              to="/body"
              value={bw ? formatWeight(bw.latest.weightKg, prefs.weightUnit) : 'Not logged'}
            />
            <ListRow
              icon={Activity}
              tone="lime"
              title="Daily activity"
              value={profile.dailyActivity ? ACTIVITY_LABEL[profile.dailyActivity] : NOT_SET}
            />
          </ListGroup>
        </div>
      ) : null}
    </>
  );
}

const options = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted">{label}</p>
      {children}
    </div>
  );
}

function ProfileForm({ initial, onDone }: { initial: Profile | null; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(initial?.displayName ?? '');
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? '');
  const [goal, setGoal] = useState<Goal>(initial?.goal ?? 'strength_hypertrophy');
  const [experience, setExperience] = useState<Experience>(initial?.experience ?? 'beginner');
  const [sex, setSex] = useState<Sex | null>(initial?.sex ?? null);
  const [heightCm, setHeightCm] = useState<number | null>(initial?.heightCm ?? null);
  const [days, setDays] = useState<string | null>(
    initial?.trainingDays ? String(initial.trainingDays) : null,
  );
  const [minutes, setMinutes] = useState<string | null>(
    initial?.sessionMinutes ? String(initial.sessionMinutes) : null,
  );
  const [equipment, setEquipment] = useState<GymAccess | null>(initial?.equipment ?? null);
  const [activity, setActivity] = useState<DailyActivity | null>(initial?.dailyActivity ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveProfile(db, {
        displayName: name,
        birthDate: birthDate || null,
        goal,
        experience,
        sex,
        heightCm,
        trainingDays: days ? Number(days) : null,
        sessionMinutes: minutes ? Number(minutes) : null,
        equipment,
        dailyActivity: activity,
      });
      toast('Profile saved');
      onDone();
    } catch (err) {
      setError(err instanceof ProfileError ? err.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="flex flex-col gap-6" onSubmit={submit}>
      <TextField
        label="Name"
        autoComplete="given-name"
        maxLength={60}
        required
        value={name}
        error={error}
        onChange={(e) => setName(e.target.value)}
      />
      <Field label="Goal">
        <Chips
          label="Goal"
          options={options(GOAL_LABEL)}
          value={goal}
          onChange={(v) => v && setGoal(v)}
          className="sm:flex-wrap"
        />
      </Field>
      <Field label="Experience">
        <Chips
          label="Experience"
          options={options(EXPERIENCE_LABEL)}
          value={experience}
          onChange={(v) => v && setExperience(v)}
        />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Days a week">
          <Chips
            label="Days a week"
            allLabel="Not set"
            options={['2', '3', '4', '5', '6', '7'].map((v) => ({ value: v, label: v }))}
            value={days}
            onChange={setDays}
          />
        </Field>
        <Field label="Session length">
          <Chips
            label="Session length"
            allLabel="Not set"
            options={['30', '45', '60', '75', '90', '120'].map((v) => ({
              value: v,
              label: `${v} min`,
            }))}
            value={minutes}
            onChange={setMinutes}
          />
        </Field>
      </div>
      <Field label="Equipment">
        <Chips
          label="Equipment"
          allLabel="Not set"
          options={options(EQUIPMENT_LABEL)}
          value={equipment}
          onChange={setEquipment}
          className="sm:flex-wrap"
        />
      </Field>
      <Field label="Sex">
        <Chips
          label="Sex"
          allLabel="Not set"
          options={options(SEX_LABEL)}
          value={sex}
          onChange={setSex}
        />
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label="Birth date"
          type="date"
          max={toDateKey(new Date())}
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
        <NumberField
          label="Height"
          unit="cm"
          value={heightCm}
          min={100}
          max={250}
          onValueChange={setHeightCm}
        />
      </div>
      <Field label="Outside the gym, your day is">
        <Chips
          label="Daily activity"
          allLabel="Not set"
          options={options(ACTIVITY_LABEL)}
          value={activity}
          onChange={setActivity}
          className="sm:flex-wrap"
        />
      </Field>
      <Button type="submit" size="lg" block disabled={busy}>
        {busy ? 'Saving...' : 'Save profile'}
      </Button>
    </form>
  );
}
