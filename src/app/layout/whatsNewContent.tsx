import type { ReactNode } from 'react';
import { BrainArt, FoodArt, LifeArt, NowArt, PlanArt, SocialArt, VoiceArt } from './whatsNewArt';
import { BoardArt, LookArt, PayArt, PlansArt } from './whatsNewArt2';

/**
 * What each release brings, part by part. The latest is shown as a walkthrough once after the
 * update; both stay on the "What is new" page in More.
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

/** The Macrotrophy Brain (early November 2026). */
export const BRAIN_TITLE = 'Macrotrophy now learns you';

export const BRAIN_STEPS: ReleaseStep[] = [
  {
    id: 'brain',
    kicker: 'The biggest update yet',
    title: BRAIN_TITLE,
    lead: 'One brain inside the app. It reads your logs every week and gets to know how your body answers to food and training.',
    art: <BrainArt />,
    points: [
      { strong: 'No new tabs.', text: 'Everything lives in the screens you already know.' },
      {
        strong: 'Maths decides, AI explains.',
        text: 'Every number comes from tested rules and your own logs.',
      },
      {
        strong: 'Nothing changes without your yes.',
        text: 'The app proposes; you apply it or keep your plan.',
      },
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
      {
        strong: 'Your real maintenance.',
        text: 'Worked out from what you ate and how your weight moved, not from a formula alone.',
      },
      {
        strong: 'Small, safe steps.',
        text: 'At most 150 kcal and 2 sets per muscle a week, never under your safe calorie floor.',
      },
      {
        strong: 'A Why on every change.',
        text: 'One tap opens the reason and the research behind it.',
      },
      {
        strong: 'Try a different plan.',
        text: 'Slide calories and sets and see where 8 weeks would likely take you.',
      },
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
      {
        strong: 'Coming up.',
        text: 'Exams, travel, a wedding, a festival, a vrat, Ramadan or being unwell. No deficit and nothing added while it lasts.',
      },
      {
        strong: 'Something hurts.',
        text: 'In a workout, open an exercise menu. The plan swaps the lifts that load the area and trims the work for a few weeks.',
      },
      {
        strong: 'Red flags stop it.',
        text: 'Sharp or lasting pain, swelling or numbness: the app tells you to see a professional. It is training guidance, not medical advice.',
      },
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
      {
        strong: 'Eat next.',
        text: 'Three foods that fit your remaining calories and protein, picked from what you actually eat. One tap logs them.',
      },
      {
        strong: 'Plan my week.',
        text: 'Seven days of Indian meals for home, hostel, mess or PG, your diet and your budget, with a grocery list.',
      },
      {
        strong: 'Read a menu.',
        text: 'Photograph a restaurant or mess menu and see which dishes fit. The AI reads the names; the numbers come from the food library.',
      },
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
      {
        strong: '"80 kilo 8 reps", "80 ke 8", "assi kilo aath".',
        text: 'All understood, with Indian accents in mind.',
      },
      { strong: '"Same again".', text: 'Repeats your last set.' },
      {
        strong: 'It waits for you.',
        text: 'A pause between the weight and the reps no longer cuts you off, in workouts and in food logging.',
      },
      {
        strong: 'Never guesses.',
        text: 'If it is not sure, it fills the set in and waits for your tap.',
      },
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
      {
        strong: 'Now card.',
        text: 'Weigh in, log a meal, start your session, close your protein gap. It changes through the day; the rest of Home stays put.',
      },
      {
        strong: 'Macrotrophy AI knows your week.',
        text: 'Your plan, what is coming up, what hurts and what you told it go into every answer.',
      },
      {
        strong: 'You are in charge of it.',
        text: 'See, edit or delete everything it knows in Settings.',
      },
      {
        strong: 'Sharper answers.',
        text: 'It answers the question first, from the numbers that matter for it.',
      },
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
      {
        strong: 'Duels.',
        text: 'In any group, challenge a member. Most points by Sunday wins, on the same points as the board.',
      },
      {
        strong: 'Wrapped.',
        text: 'Your month as a story card: workouts, kilos lifted, records. A yearly one in December.',
      },
    ],
    plan: 'For everyone',
    where: { label: 'Open Groups', to: '/groups' },
  },
];

/** Fair play, paying your way and a fresh look (mid November 2026): the latest release. */
export const RELEASE_TITLE = 'Fairer, clearer, sharper';

export const RELEASE_STEPS: ReleaseStep[] = [
  {
    id: 'look',
    kicker: 'A fresh look',
    title: RELEASE_TITLE,
    lead: 'Small things that make every screen easier to read at a glance.',
    art: <LookArt />,
    points: [
      {
        strong: 'Muscles this week.',
        text: 'At the end of Home, a body map of what you trained this week.',
      },
      {
        strong: 'Templates show their week.',
        text: 'Every routine template shows its training days before you pick it.',
      },
      {
        strong: 'The science, with sources.',
        text: 'Every paper behind a number, with its year and a link, on one page anyone can read.',
      },
    ],
    plan: 'For everyone',
    where: { label: 'Open Home', to: '/' },
  },
  {
    id: 'fair',
    kicker: 'Leaderboards',
    title: 'Effort beats ego',
    lead: 'Points now reward showing up and getting stronger than you were, and they are much harder to game.',
    art: <BoardArt />,
    points: [
      {
        strong: 'New points.',
        text: 'Training three days in a week and beating your own lifts both score. One workout a day counts.',
      },
      {
        strong: 'Logged as you train.',
        text: 'Sets ticked all at once after the session no longer count.',
      },
      {
        strong: 'See what the best train.',
        text: 'Tap anyone on a board to see their split and exercises, never their weights. Copy it into your routines with Pro.',
      },
      {
        strong: 'Your choice.',
        text: "Your routine is shown by default. Turn it off in the board's privacy settings.",
      },
    ],
    plan: 'Boards for everyone. Copying a routine is Pro',
    where: { label: 'See the board', to: '/groups/global' },
  },
  {
    id: 'pay',
    kicker: 'Pro',
    title: 'Pay your way',
    lead: 'Pick autopay or a single payment on any plan, and add time whenever you like.',
    art: <PayArt />,
    points: [
      {
        strong: 'Autopay or pay once.',
        text: 'Both on every plan. Autopay can be turned off at any time.',
      },
      { strong: 'Add more time.', text: 'Paying before Pro ends adds the new time after it.' },
      { strong: 'Codes.', text: 'Have a code? Add it when you pay.' },
      {
        strong: 'Already on a plan?',
        text: 'Your price changes only at your next renewal, and the plans card shows it first.',
      },
    ],
    plan: 'Pro from ₹149 a month',
    where: { label: 'See plans', to: '/pro' },
  },
  {
    id: 'plans',
    kicker: 'Free and Pro',
    title: 'What each plan includes',
    lead: 'Free stays free for logging and your whole history. Pro is for the coaching around it.',
    art: <PlansArt />,
    points: [
      {
        strong: 'Free.',
        text: 'Unlimited workout logging, all your history and records, 2 routines, calories, a group and the global board, and the last 7 days of progress.',
      },
      {
        strong: 'Pro.',
        text: 'The weekly plan, protein and macros, Macrotrophy AI, meal plans, the weekly report, long trends, gym tools and more.',
      },
      {
        strong: 'Nothing is taken away.',
        text: 'Routines and groups you already have stay, and everything you logged is yours.',
      },
    ],
    plan: 'Free, or Pro from ₹149 a month',
    where: { label: 'Compare plans', to: '/pro' },
  },
];
