-- Round 4 (October 2026): reps for the left and right side of one-arm and one-leg exercises,
-- and the box squat plus ten one-sided exercises in the shared library. Safe to run more than
-- once. Run it in the SQL editor before the app version that needs it is deployed.

-- Reps with each side; `reps` keeps the weaker side, so every existing number still works.
alter table public.sets add column if not exists reps_left integer;
alter table public.sets add column if not exists reps_right integer;
alter table public.sets drop constraint if exists sets_reps_left_check;
alter table public.sets add constraint sets_reps_left_check
  check (reps_left is null or (reps_left >= 0 and reps_left <= 1000));
alter table public.sets drop constraint if exists sets_reps_right_check;
alter table public.sets add constraint sets_reps_right_check
  check (reps_right is null or (reps_right >= 0 and reps_right <= 1000));

-- Whether an exercise in a workout or a routine is logged per side (null: its own default).
alter table public.workout_exercises add column if not exists by_side boolean;
alter table public.routine_exercises add column if not exists by_side boolean;

-- Generated from src/data/library/exercises.ts by src/data/sync/seed.ts. Do not edit by hand.
insert into public.exercises (
  id, key, name, primary_muscle, secondary_muscles, equipment, category, tracking_type,
  load_mode, instructions, created_at, updated_at
) values
  ('cf2033e9-4707-4048-8968-ceef7db2d30b', 'box-squat', 'Box squat', 'quads', array['glutes', 'hamstrings', 'back']::text[], 'barbell', 'compound', 'weight_reps', 'total', 'Set a box or bench behind you at the depth you want, usually with the thighs about level with the floor when seated. With the bar on your upper back and the feet a little wider than for a back squat, push the hips back and sit down onto the box under control. Pause briefly with the back tight and the shins near vertical, without relaxing or rocking, then drive up through the whole foot to standing.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('03d8e8b3-5d51-451e-8bcd-a6edede9133c', 'one-arm-cable-triceps-extension', 'One-arm cable triceps extension', 'triceps', array[]::text[], 'cable', 'isolation', 'weight_reps', 'total', 'Fit a cuff or a single handle to a high cable. Keep the upper arm still by your side, or by your head for the overhead version, and straighten the elbow fully, then let it bend back slowly. Do all the reps with one arm, then the other, and log each side.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('650e8f0c-dfa8-4cf7-b73e-9e8a45752723', 'one-arm-machine-lateral-raise', 'One-arm machine lateral raise', 'shoulders', array[]::text[], 'machine', 'isolation', 'weight_reps', 'total', 'Sit or stand side-on in the lateral raise machine with the pad against the outside of one arm. Raise the arm out to the side to about shoulder height, leading with the elbow, then lower slowly. Finish one side, then switch, and log each side.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('f69b753a-64e7-4c8d-8f04-e387257a6fb9', 'single-leg-extension', 'Single-leg extension', 'quads', array[]::text[], 'machine', 'isolation', 'weight_reps', 'total', 'Sit in the leg extension machine with the pad on one shin, just above the ankle. Straighten the knee fully and squeeze the front of the thigh, then lower slowly. Do one leg, then the other, and log each side.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('cb92aece-0c54-4946-96b8-a942c5a13bed', 'one-arm-pec-deck', 'One-arm pec deck', 'chest', array['shoulders']::text[], 'machine', 'isolation', 'weight_reps', 'total', 'Sit in the pec deck and use one handle or pad at a time, the other arm braced. Bring the arm across in an arc until the hand is in front of the chest, then open slowly until the chest stretches. Finish one side, then switch, and log each side.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('b8ea078c-506a-468e-a94d-e373717847c0', 'single-leg-press', 'Single-leg press', 'quads', array['glutes', 'hamstrings']::text[], 'machine', 'compound', 'weight_reps', 'total', 'Place one foot in the middle of the platform, the other off to the side. Lower the platform until the knee is well bent with the lower back still on the pad, then press up without locking the knee hard. Do one leg, then the other, and log each side.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('efc61634-11dd-4119-9793-dce9757a1f87', 'single-leg-curl', 'Single-leg curl', 'hamstrings', array[]::text[], 'machine', 'isolation', 'weight_reps', 'total', 'In a seated or lying leg curl, set the pad behind one ankle. Curl the heel towards you as far as it goes, then let the leg straighten slowly. Do one leg, then the other, and log each side.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('86b2ebb4-e87e-4033-83d1-b9f83dc5f394', 'one-arm-lat-pulldown', 'One-arm lat pulldown', 'back', array['biceps']::text[], 'cable', 'compound', 'weight_reps', 'total', 'Hold a single handle on a high cable, kneeling or seated with the arm overhead. Pull the elbow down to your side and slightly back, without twisting the torso, then let the arm rise fully. Do one arm, then the other, and log each side.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('4386c615-a35b-4601-89e2-b92aadea4b7a', 'one-arm-cable-row', 'One-arm cable row', 'back', array['biceps']::text[], 'cable', 'compound', 'weight_reps', 'total', 'Hold a single handle on a cable at chest or waist height. Sit or stand tall and row the elbow back past the body, then reach forward again until the shoulder blade moves forward. Do one arm, then the other, and log each side.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('d3011d28-ca47-42b8-a483-536f69d817c0', 'one-arm-cable-curl', 'One-arm cable curl', 'biceps', array[]::text[], 'cable', 'isolation', 'weight_reps', 'total', 'Hold a single handle on a low cable with the palm up. Keep the elbow by your side and curl the hand up to the shoulder, then lower slowly to a straight arm. Do one arm, then the other, and log each side.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('be5af079-e845-40a0-8f07-9af6493c7f09', 'single-leg-romanian-deadlift', 'Single-leg Romanian deadlift', 'hamstrings', array['glutes', 'back']::text[], 'dumbbell', 'compound', 'weight_reps', 'total', 'Stand on one leg with a slight knee bend, a dumbbell in the opposite hand. Hinge at the hip, letting the free leg reach back in line with the torso, until the standing hamstring stretches, then stand tall. Log the weight in your hand and the reps for each leg.', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
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
