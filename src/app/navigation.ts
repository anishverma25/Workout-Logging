import type { LucideIcon } from 'lucide-react';
import {
  CalendarRange,
  ChartNoAxesColumnIncreasing,
  Crown,
  Dumbbell,
  History,
  House,
  Library,
  Scale,
  Settings,
  Trophy,
  UserRound,
} from 'lucide-react';

export const APP_NAME = 'Overload';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Bottom navigation on mobile (Workout sits in the centre, in thumb reach). */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: House },
  { to: '/routines', label: 'Routines', icon: CalendarRange },
  { to: '/workout', label: 'Workout', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: ChartNoAxesColumnIncreasing },
  { to: '/history', label: 'History', icon: History },
];

export const SECONDARY_NAV: NavItem[] = [
  { to: '/records', label: 'Records', icon: Trophy },
  { to: '/exercises', label: 'Exercises', icon: Library },
  { to: '/body', label: 'Body metrics', icon: Scale },
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/pro', label: 'Pro', icon: Crown },
];
