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

`src/domain/muscles/targets.ts` lists, for each of the 120 library exercises: main muscles,
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
