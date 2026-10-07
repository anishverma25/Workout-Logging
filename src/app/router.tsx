import { createBrowserRouter } from 'react-router';
import { AppShell } from './layout/AppShell';
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
  {
    path: 'setup',
    errorElement: <RouteError />,
    lazy: page(() => import('@/features/setup/SetupPage'), 'SetupPage'),
  },
  {
    element: <AppShell />,
    errorElement: <RouteError />,
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
      {
        path: 'progress',
        lazy: page(() => import('@/features/progress/ProgressPage'), 'ProgressPage'),
      },
      {
        path: 'progress/methodology',
        lazy: page(() => import('@/features/progress/MethodologyPage'), 'MethodologyPage'),
      },
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
        path: 'feedback',
        lazy: page(() => import('@/features/feedback/FeedbackPage'), 'FeedbackPage'),
      },
      {
        path: 'account',
        lazy: page(() => import('@/features/account/AccountPage'), 'AccountPage'),
      },
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
      { path: '*', lazy: page(() => import('@/features/pages'), 'NotFoundPage') },
    ],
  },
]);
