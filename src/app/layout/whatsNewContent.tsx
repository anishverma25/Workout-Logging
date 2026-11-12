import type { ReactNode } from 'react';
import { BrainArt, FoodArt, LifeArt, NowArt, PlanArt, SocialArt, VoiceArt } from './whatsNewArt';

/**
 * What this release (November 2026, the Macrotrophy Brain) brings, part by part. Shown as a
 * walkthrough once after the update, and kept on the "What is new" page in More.
 */
export interface ReleaseStep {
  id: string;
  kicker: string;
  title: string;
  lead: string;
  art: ReactNode;
  points: { strong: string; text: string }[];
  /** Free, Pro, or both, said plainly. */
  plan: string;
  /** Where to find it. */
  where: { label: string; to: string };
}

export const RELEASE_TITLE = 'Macrotrophy now learns you';

export const RELEASE_STEPS: ReleaseStep[] = [
  {
    id: 'brain',
    kicker: 'The biggest update yet',
    title: RELEASE_TITLE,
    lead: 'One brain inside the app. It reads your logs every week and gets to know how your body answers to food and training.',
    art: <BrainArt />,
    points: [
      { strong: 'No new tabs.', text: 'Everything lives in the screens you already know.' },
      { strong: 'Maths decides, AI explains.', text: 'Every number comes from tested rules and your own logs.' },
      { strong: 'Nothing changes without your yes.', text: 'The app proposes; you apply it or keep your plan.' },
    ],
    plan: 'For everyone',
    where: { label: 'See what is new', to: '/whats-new' },
  },
  {
    id: 'plan',
    kicker: 'Adaptive plan',
    title: 'Your week and next week',
    lead: 'Your weekly report now ends with next week: calories, protein and sets, changed only as far as your results say.',
    art: <PlanArt />,
    points: [
      { strong: 'Your real maintenance.', text: 'Worked out from what you ate and how your weight moved, not from a formula alone.' },
      { strong: 'Small, safe steps.', text: 'At most 150 kcal and 2 sets per muscle a week, never under your safe calorie floor.' },
      { strong: 'A Why on every change.', text: 'One tap opens the reason and the research behind it.' },
      { strong: 'Try a different plan.', text: 'Slide calories and sets and see where 8 weeks would likely take you.' },
    ],
    plan: 'Pro',
    where: { label: 'Open your week', to: '/report' },
  },
  {
    id: 'life',
    kicker: 'Plans around your life',
    title: 'Exams, travel, fasts and pain',
    lead: 'Tell the app what is coming up or what hurts, and the plan bends around it, then goes back by itself.',
    art: <LifeArt />,
    points: [
      { strong: 'Coming up.', text: 'Exams, travel, a wedding, a festival, a vrat, Ramadan or being unwell. No deficit and nothing added while it lasts.' },
      { strong: 'Something hurts.', text: 'In a workout, open an exercise menu. The plan swaps the lifts that load the area and trims the work for a few weeks.' },
      { strong: 'Red flags stop it.', text: 'Sharp or lasting pain, swelling or numbness: the app tells you to see a professional. It is training guidance, not medical advice.' },
    ],
    plan: 'Free to log pain, Pro to adapt the plan',
    where: { label: 'Add what is coming up', to: '/report' },
  },
  {
    id: 'food',
    kicker: 'Food that plans itself',
    title: 'Eat next, meal plans and menus',
    lead: 'The Food tab now answers "what should I eat" from what is left of your day.',
    art: <FoodArt />,
    points: [
      { strong: 'Eat next.', text: 'Three foods that fit your remaining calories and protein, picked from what you actually eat. One tap logs them.' },
      { strong: 'Plan my week.', text: 'Seven days of Indian meals for home, hostel, mess or PG, your diet and your budget, with a grocery list.' },
      { strong: 'Read a menu.', text: 'Photograph a restaurant or mess menu and see which dishes fit. The AI reads the names; the numbers come from the food library.' },
    ],
    plan: 'Eat next is free. Meal plans and menus are Pro',
    where: { label: 'Open Food', to: '/food' },
  },
  {
    id: 'voice',
    kicker: 'Voice sets',
    title: 'Log a set by saying it',
    lead: 'Tap the mic in a workout and say the set, in English or Hinglish.',
    art: <VoiceArt />,
    points: [
      { strong: '"80 kilo 8 reps", "80 ke 8", "assi kilo aath".', text: 'All understood, with Indian accents in mind.' },
      { strong: '"Same again".', text: 'Repeats your last set.' },
      { strong: 'It waits for you.', text: 'A pause between the weight and the reps no longer cuts you off, in workouts and in food logging.' },
      { strong: 'Never guesses.', text: 'If it is not sure, it fills the set in and waits for your tap.' },
    ],
    plan: 'For everyone',
    where: { label: 'Start a workout', to: '/workout' },
  },
  {
    id: 'now',
    kicker: 'Every day',
    title: 'A Now card, and an AI that remembers',
    lead: 'Home shows the one thing that matters right now, and Macrotrophy AI stops asking you to repeat yourself.',
    art: <NowArt />,
    points: [
      { strong: 'Now card.', text: 'Weigh in, log a meal, start your session, close your protein gap. It changes through the day; the rest of Home stays put.' },
      { strong: 'Macrotrophy AI knows your week.', text: 'Your plan, what is coming up, what hurts and what you told it go into every answer.' },
      { strong: 'You are in charge of it.', text: 'See, edit or delete everything it knows in Settings.' },
      { strong: 'Sharper answers.', text: 'It answers the question first, from the numbers that matter for it.' },
    ],
    plan: 'Now card for everyone. Macrotrophy AI is Pro',
    where: { label: 'See what it knows', to: '/settings/memory' },
  },
  {
    id: 'social',
    kicker: 'With friends',
    title: 'Duels and Wrapped',
    lead: 'Challenge a friend for the week, and get your month in numbers on the 1st.',
    art: <SocialArt />,
    points: [
      { strong: 'Duels.', text: 'In any group, challenge a member. Most points by Sunday wins, on the same points as the board.' },
      { strong: 'Wrapped.', text: 'Your month as a story card: workouts, kilos lifted, records. A yearly one in December.' },
    ],
    plan: 'For everyone',
    where: { label: 'Open Groups', to: '/groups' },
  },
];
