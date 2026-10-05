import { createBrowserRouter } from 'react-router';
import { AppShell } from './layout/AppShell';
import { HomePage } from '@/features/home/HomePage';
import { HistoryPage } from '@/features/history/HistoryPage';
import { MorePage } from '@/features/more/MorePage';
import {
  BodyPage,
  ExercisesPage,
  NotFoundPage,
  ProgressPage,
  ProPage,
  WorkoutPage,
} from '@/features/pages';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { RoutinesPage } from '@/features/routines/RoutinesPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'workout', element: <WorkoutPage /> },
      { path: 'routines', element: <RoutinesPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'history', element: <HistoryPage /> },
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
