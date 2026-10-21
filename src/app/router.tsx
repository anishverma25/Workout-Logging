import { createBrowserRouter } from 'react-router';
import { MethodologyRedirect } from './layout/MethodologyRedirect';
import { AppShell } from './layout/AppShell';
import { AuthScreen } from './layout/AuthScreen';
import { RequireAccount } from './layout/RequireAccount';
import { RouteError } from './layout/RouteError';
import { HomePage } from '@/features/home/HomePage';
import { SummaryPage } from '@/features/workout/SummaryPage';
import { WorkoutPage } from '@/features/workout/WorkoutPage';

/**
 * Home, the workout logger and its summary load with the app: logging and finishing a workout
 * must work even before the service worker has cached anything. Every other
 * screen is its own chunk, fetched on first visit (and precached by the service worker, so it
 * still opens offline).
 */
const page =
  <M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M & string) =>
  async () => ({ Component: (await load())[name] as React.ComponentType });

export const router = createBrowserRouter([
  // Full screen, without the navigation: the preview tour and first-time setup.
  {
    path: 'welcome',
    errorElement: <RouteError />,
    lazy: page(() => import('@/features/tour/TourPage'), 'TourPage'),
  },
  // Public pages, readable without an account: the legal pages Razorpay and users look for.
  {
    path: 'terms',
    errorElement: <RouteError />,
    lazy: page(() => import('@/features/legal/LegalPage'), 'TermsPage'),
  },
  {
    path: 'privacy',
    errorElement: <RouteError />,
    lazy: page(() => import('@/features/legal/LegalPage'), 'PrivacyPage'),
  },
  {
    path: 'refunds',
    errorElement: <RouteError />,
    lazy: page(() => import('@/features/legal/LegalPage'), 'RefundsPage'),
  },
  {
    path: 'contact',
    errorElement: <RouteError />,
    lazy: page(() => import('@/features/legal/LegalPage'), 'ContactPage'),
  },
  // Getting into an account, reachable without one.
  {
    element: <AuthScreen />,
    errorElement: <RouteError />,
    children: [
      { path: 'sign-in', lazy: page(() => import('@/features/account/AuthPages'), 'SignInPage') },
      { path: 'sign-up', lazy: page(() => import('@/features/account/AuthPages'), 'SignUpPage') },
      {
        path: 'forgot-password',
        lazy: page(() => import('@/features/account/AuthPages'), 'ForgotPasswordPage'),
      },
      {
        path: 'reset-password',
        lazy: page(() => import('@/features/account/AuthPages'), 'NewPasswordPage'),
      },
    ],
  },
  // The app itself: an account is required, so every screen has a backup and a sync target.
  {
    element: <RequireAccount />,
    errorElement: <RouteError />,
    children: [
      {
        path: 'setup',
        lazy: page(() => import('@/features/setup/SetupPage'), 'SetupPage'),
      },
      // Bringing history over from Hevy or Strong: after sign-up, and from More and Settings.
      {
        path: 'import',
        lazy: page(() => import('@/features/import/ImportPage'), 'ImportPage'),
      },
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'workout', element: <WorkoutPage /> },
          { path: 'workouts/:workoutId/summary', element: <SummaryPage /> },
          {
            path: 'routines',
            lazy: page(() => import('@/features/routines/RoutinesPage'), 'RoutinesPage'),
          },
          {
            path: 'routines/:routineId',
            lazy: page(() => import('@/features/routines/RoutineEditorPage'), 'RoutineEditorPage'),
          },
          { path: 'food', lazy: page(() => import('@/features/food/FoodPage'), 'FoodPage') },
          {
            path: 'progress',
            lazy: page(() => import('@/features/progress/ProgressPage'), 'ProgressPage'),
          },
          {
            path: 'science',
            lazy: page(() => import('@/features/science/SciencePage'), 'SciencePage'),
          },
          // The old address of the methodology page, kept for bookmarks and installed shortcuts.
          { path: 'progress/methodology', Component: MethodologyRedirect },
          {
            path: 'history',
            lazy: page(() => import('@/features/history/HistoryPage'), 'HistoryPage'),
          },
          {
            path: 'history/:workoutId',
            lazy: page(() => import('@/features/history/WorkoutDetailPage'), 'WorkoutDetailPage'),
          },
          {
            path: 'records',
            lazy: page(() => import('@/features/records/RecordsPage'), 'RecordsPage'),
          },
          {
            path: 'exercises',
            lazy: page(() => import('@/features/exercises/ExercisesPage'), 'ExercisesPage'),
          },
          { path: 'body', lazy: page(() => import('@/features/body/BodyPage'), 'BodyPage') },
          {
            path: 'badges',
            lazy: page(() => import('@/features/medals/BadgesPage'), 'BadgesPage'),
          },
          {
            path: 'journey',
            lazy: page(() => import('@/features/journey/JourneyPage'), 'JourneyPage'),
          },
          {
            path: 'profile',
            lazy: page(() => import('@/features/profile/ProfilePage'), 'ProfilePage'),
          },
          {
            path: 'settings',
            lazy: page(() => import('@/features/settings/SettingsPage'), 'SettingsPage'),
          },
          { path: 'pro', lazy: page(() => import('@/features/pro/ProPage'), 'ProPage') },
          { path: 'more', lazy: page(() => import('@/features/more/MorePage'), 'MorePage') },
          {
            path: 'coach',
            lazy: page(() => import('@/features/coach/CoachPage'), 'CoachPage'),
          },
          {
            path: 'feedback',
            lazy: page(() => import('@/features/feedback/FeedbackPage'), 'FeedbackPage'),
          },
          {
            path: 'account',
            lazy: page(() => import('@/features/account/AccountPage'), 'AccountPage'),
          },
          { path: '*', lazy: page(() => import('@/features/pages'), 'NotFoundPage') },
        ],
      },
    ],
  },
]);
