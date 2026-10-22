import type { LucideIcon } from 'lucide-react';
import {
  CalendarRange,
  CircleUserRound,
  Flame,
  ChartNoAxesColumnIncreasing,
  Crown,
  Dumbbell,
  FlaskConical,
  History,
  House,
  Library,
  Medal,
  MessageSquareHeart,
  Route,
  Scale,
  Settings,
  Sparkles,
  Trophy,
  UserRound,
  UtensilsCrossed,
} from 'lucide-react';

import type { TileTone } from '@/components/ui/List';

export const APP_NAME = 'Overload';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Icon tile colour in grouped lists. */
  tone?: TileTone;
  /** Group in the More list. */
  group?: 'you' | 'training' | 'app';
  /** False keeps it out of the phone's bottom bar (it is under More instead). */
  bottom?: boolean;
}

/**
 * The main areas: training on the left, food in the middle; activity is under More on a phone and on Home, then
 * results. The phone's bottom bar shows six of them (`BOTTOM_NAV`); the rest are under More.
 */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: House },
  { to: '/routines', label: 'Routines', icon: CalendarRange },
  { to: '/workout', label: 'Workout', icon: Dumbbell },
  { to: '/food', label: 'Food', icon: UtensilsCrossed },
  { to: '/activity', label: 'Activity', icon: Flame, bottom: false },
  { to: '/progress', label: 'Progress', icon: ChartNoAxesColumnIncreasing },
  { to: '/history', label: 'History', icon: History },
];

export const BOTTOM_NAV = PRIMARY_NAV.filter((i) => i.bottom !== false);

export const SECONDARY_NAV: NavItem[] = [
  { to: '/badges', label: 'Badges', icon: Medal, tone: 'amber', group: 'you' },
  { to: '/journey', label: 'Journey', icon: Route, tone: 'ember', group: 'you' },
  { to: '/body', label: 'Body metrics', icon: Scale, tone: 'sky', group: 'you' },
  { to: '/records', label: 'Records', icon: Trophy, tone: 'amber', group: 'training' },
  { to: '/exercises', label: 'Exercises', icon: Library, tone: 'lime', group: 'training' },
  { to: '/science', label: 'The science', icon: FlaskConical, tone: 'sky', group: 'training' },
  { to: '/coach', label: 'OverloadGPT', icon: Sparkles, tone: 'lime', group: 'training' },
  { to: '/profile', label: 'Profile', icon: UserRound, tone: 'iris', group: 'you' },
  { to: '/account', label: 'Account', icon: CircleUserRound, tone: 'graphite', group: 'app' },
  { to: '/settings', label: 'Settings', icon: Settings, tone: 'graphite', group: 'app' },
  { to: '/pro', label: 'Pro', icon: Crown, tone: 'plum', group: 'app' },
  {
    to: '/feedback',
    label: 'Send feedback',
    icon: MessageSquareHeart,
    tone: 'rose',
    group: 'app',
  },
];
