-- Round 2 exercises (October 2026): Kelso shrug, Keenan flap, behind-the-neck press,
-- brachioradialis curl and dumbbell stiff-leg deadlift, added to the shared library with the
-- same ids the app uses. Safe to run more than once.

-- Generated from src/data/library/exercises.ts by src/data/sync/seed.ts. Do not edit by hand.
insert into public.exercises (
  id, key, name, primary_muscle, secondary_muscles, equipment, category, tracking_type,
  load_mode, instructions, created_at, updated_at
) values
  ('5955b1d9-3d50-4bc7-99f4-e94f9de0bbd6', 'kelso-shrug', 'Kelso shrug', 'back', array[]::text[], 'dumbbell', 'isolation', 'weight_reps', 'per_hand', 'Lie chest down on a bench set to a low incline with the dumbbells hanging straight down. Keeping the arms straight, pull the shoulder blades back and together, hold for a second, then let them spread apart. The arms do not bend. Log one dumbbell.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('0d710bdd-f527-4310-9922-abdeb5489777', 'keenan-flap', 'Keenan flap', 'back', array[]::text[], 'cable', 'isolation', 'weight_reps', 'total', 'Fit a cuff just above the elbow, with the cable set high. Sit sideways on a high incline bench and, with the arm nearly straight, pull the elbow down and in toward your side, then let it rise slowly overhead. One arm at a time.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('f92bd34f-cfa4-4c85-8be4-be1e35cd7751', 'behind-the-neck-press', 'Behind-the-neck press', 'shoulders', array['triceps']::text[], 'barbell', 'compound', 'weight_reps', 'total', 'Seated or standing, hold the bar behind the head with a grip a little wider than the shoulders. Press it straight up to lockout, then lower it under control to about ear level. Only use it if you can reach that position without pain; stop short of the neck.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('7f595e39-9c1d-4d6a-8e7d-c1122dc25f4a', 'brachioradialis-curl', 'Brachioradialis curl', 'biceps', array[]::text[], 'dumbbell', 'isolation', 'weight_reps', 'per_hand', 'Hold the dumbbells with palms facing down (a reverse grip). Keep the elbows by your sides and curl up without letting the wrists drop, then lower slowly. Thumbs-up hammer curls work the same muscle a little less. Log one dumbbell.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('f4679f4f-b703-4f12-a686-e31911c7bb07', 'dumbbell-stiff-leg-deadlift', 'Dumbbell stiff-leg deadlift', 'hamstrings', array['glutes', 'back']::text[], 'dumbbell', 'compound', 'weight_reps', 'per_hand', 'Stand with the dumbbells in front of the thighs and the knees only slightly bent. Push the hips back and lower the dumbbells along the legs with a flat back until the hamstrings stretch, then stand tall by driving the hips forward. Log one dumbbell.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
on conflict (id) do update set
  key = excluded.key,
  name = excluded.name,
  primary_muscle = excluded.primary_muscle,
  secondary_muscles = excluded.secondary_muscles,
  equipment = excluded.equipment,
  category = excluded.category,
  tracking_type = excluded.tracking_type,
  load_mode = excluded.load_mode,
  instructions = excluded.instructions,
  updated_at = excluded.updated_at;
