# Muscles in detail (November 2026)

## Hierarchy

`src/domain/muscles/taxonomy.ts` holds every muscle once, in three levels:

1. **Regions (8):** Chest, Back, Shoulders, Arms, Core, Hips, Legs, Neck.
2. **Gym groups (26):** Chest, Lats, Upper back, Traps, Serratus, Lower back, Delts, Rotator cuff,
   Biceps, Triceps, Forearms, Abs, Obliques, Deep core, Glutes, Abductors, Hip flexors,
   Adductors, Hip rotators, Quads, Hamstrings, Calves, Shins, Ankles and feet, Neck front and back.
3. **Muscles, heads and regions (88):** for example the clavicular and sternocostal pec, the
   three trapezius regions, the four rotator cuff muscles, the biceps and triceps heads,
   brachialis, wrist and finger flexors and extensors, rectus femoris and the vasti, the
   hamstring muscles, gastrocnemius heads, soleus, tibialis anterior, the peroneals and the neck
   muscles.

Each record has an anatomical name, a gym name and other names for search. A muscle in two
groups has one record with `alsoIn` (rectus femoris is a quad and a hip flexor), so nothing is
duplicated or counted twice. Every group says which of the app's 12 stored groups it counts
toward (`legacy`), so history, routines, records and the Brain are unchanged. Cardio is an
exercise kind, not a muscle.

## Exercises

`src/domain/muscles/targets.ts` lists, for each of the 201 library exercises: main muscles,
assisting muscles, stabilizers, the movement pattern, the joint actions and, where research
supports it, what the exercise biases (for example overhead extensions and the triceps long
head, seated leg curls, seated calf raises and the soleus). Every exercise was reviewed. Custom
exercises keep the groups their owner chose; no head is guessed for them.

## Counting sets

The 12-group numbers (Progress, the Brain, the weekly report) are unchanged: a hard working
set counts 1 for the main group and 0.5 for each assisting group. "Muscles in detail" on
Progress (`domain/muscles/volume.ts`) applies the same rule to the 26 groups, and shows, for
each muscle or head, only the direct sets of exercises that list it as a main muscle.
Stabilizers never count.

Limits: an exercise biases a head or region, it does not isolate it, and how much a head grows
cannot be calculated from the exercise name. The detailed numbers say which work was done, not
how much each head grew.

## In the app

- Exercises keeps the 12 muscle chips. "Muscles in detail" opens regions and groups; a group
  opens to its muscles. Only muscles some exercise trains are shown, with a count.
- Search understands muscle names, gym words and partial words ("upper chest", "rear delts",
  "biceps long head", "glute med"). A match on an exercise's own name always ranks first.
- Each exercise's sheet has "Muscles worked", closed by default.

## The muscle-targeting sheet (November 2026)

`scripts/exercise-library/import.py` reads `Exercise_Muscle_Targeting_165_Exercises_Final.xlsx`
and `Macrotrophy_42_Additional_Exercises_Researched.xlsx` (both kept beside it) and writes `src/data/library/targeting.json`. Run it again after editing the
sheet: `python3 scripts/exercise-library/import.py`. It matches every row to one library
exercise by name and equipment, checks every row adds up to 100 in 5% steps with muscles from
the Muscle key, and stops with a list instead of guessing when a row matches nothing or two.

- 120 existing exercises updated in place (same ids, history and routines untouched); 42 added
  (seeds in `exercises.ts`, server rows in migration `20261124000039_exercise_targeting.sql`,
  targets in `targets.ts` generated from the sheet's regions).
- Not added, flagged as the same movement as an existing exercise (`SAME_AS_EXISTING`): Seated
  hip abduction machine (Hip abduction machine), Single-arm cuffed cable lateral raise (Cable
  lateral raise), Single-arm overhead cable triceps extension (One-arm cable triceps extension).
- Second sheet (42 researched additions, 24 Nov 2026): 39 added (rows 162 to 200, same
  migration 0039). Not added, same movement: Weighted neck flexion (Neck flexion), Weighted neck
  extension (Neck extension), Single-arm cable rear delt fly (Bayesian cable rear-delt fly); their
  search words go to the existing exercise. "Bilateral cable rear delt fly" is shown as "Cable
  rear delt fly". The sheet's equipment words map to the library's (`EQUIPMENT`). Its search
  aliases are in `targeting.json` (`aliases`, used by exercise search below a name match); its
  sources are linked by URL (`citations`), and four that the app already lists use the app's
  entry (`KNOWN_SOURCES`). Its technique notes are not shown: the instructions say the same.
  New region: Thumb adductors & intrinsic hand muscles (Forearms group, plate pinch).
  Defaults: the five "Both" exercises start on the sheet's default mode (kickback, dumbbell
  preacher curl and cable front raise one side at a time; the two cable wrist curls together).
- Shares (`shares.ts`, `MUSCLE_SHARES`) are estimated contribution, not measured activation.
  They drive the body maps only; set counting stays direct (1) and indirect (0.5) by role.
- Laterality: Unilateral exercises log each side by default (`eachSide`). Eight existing ones
  became per side (`eachSideSince`): workouts made before, or already logged as one number, keep
  one number (`logsBySide`). "Both" exercises show a Both together / One side at a time switch
  on the workout card. Volume: a per-side set counts every rep of both sides; a leg exercise
  logged per hand counts both dumbbells (`sideLoadHands`).
- Stored group for exercises whose muscles are outside the 12 groups: wrist curls, pronation and
  supination under biceps, neck work under back, hip flexion under quads, tibialis and ankle
  work under calves (`NO_STORED_GROUP` in `muscles.test.ts`).

## Forearms and neck as shown groups (24 Nov 2026)

The stored group stays one of the 12 (`MUSCLE_GROUPS`), so every installed app version can read
every exercise. What people see comes from `shownGroup` (`domain/muscles/targets.ts`): an
exercise whose main muscles are all forearm muscles (wrist flexors and extensors, grip,
pronators, supinator, thumb and hand, not the brachioradialis) shows as Forearms, and neck work
as Neck ("Forearms · Barbell"). The Exercises filter has a Forearms chip after Triceps; wrist
work is listed there and no longer under Biceps.
