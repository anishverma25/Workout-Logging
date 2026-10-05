import { createBrowserRouter } from 'react-router';
import { AppShell } from './layout/AppShell';
import { RouteError } from './layout/RouteError';
import { HomePage } from '@/features/home/HomePage';
import { HistoryPage } from '@/features/history/HistoryPage';
import { MorePage } from '@/features/more/MorePage';
import { ExercisesPage } from '@/features/exercises/ExercisesPage';
import { RoutineEditorPage } from '@/features/routines/RoutineEditorPage';
import { NotFoundPage, ProgressPage, ProPage } from '@/features/pages';
import { BodyPage } from '@/features/body/BodyPage';
import { WorkoutDetailPage } from '@/features/history/WorkoutDetailPage';
import { RecordsPage } from '@/features/records/RecordsPage';
import { SummaryPage } from '@/features/workout/SummaryPage';
import { WorkoutPage } from '@/features/workout/WorkoutPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { RoutinesPage } from '@/features/routines/RoutinesPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'workout', element: <WorkoutPage /> },
      { path: 'workouts/:workoutId/summary', element: <SummaryPage /> },
      { path: 'routines', element: <RoutinesPage /> },
      { path: 'routines/:routineId', element: <RoutineEditorPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'history/:workoutId', element: <WorkoutDetailPage /> },
      { path: 'records', element: <RecordsPage /> },
      { path: 'exercises', element: <ExercisesPage /> },
      { path: 'body', element: <BodyPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'pro', element: <ProPage /> },
      { path: 'more', element: <MorePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
