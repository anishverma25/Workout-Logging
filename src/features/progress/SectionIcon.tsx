import {
  Activity,
  BatteryCharging,
  CalendarCheck,
  ChartNoAxesColumnIncreasing,
  Gauge,
  Layers,
  Lightbulb,
  Medal,
  Scale,
  Scaling,
  Snail,
  Timer,
  TrendingUp,
  Trophy,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

const SECTIONS: Record<string, { icon: LucideIcon }> = {
  insights: { icon: Lightbulb },
  progression: { icon: TrendingUp },
  strength: { icon: Activity },
  levels: { icon: Medal },
  rates: { icon: Gauge },
  plateaus: { icon: Snail },
  quality: { icon: Layers },
  ready: { icon: BatteryCharging },
  volume: { icon: ChartNoAxesColumnIncreasing },
  balance: { icon: Scaling },
  muscles: { icon: Layers },
  rest: { icon: Timer },
  consistency: { icon: CalendarCheck },
  body: { icon: Scale },
  records: { icon: Trophy },
  nutrition: { icon: Utensils },
};

/** A small neutral chip with the section's icon, beside its title. Decorative. */
export function SectionIcon({ id }: { id: string }) {
  const s = SECTIONS[id];
  if (!s) return null;
  const Icon = s.icon;
  return (
    <span
      className="relative grid size-7 shrink-0 place-items-center rounded-full"
      aria-hidden
      data-section-icon
    >
      <span className="absolute inset-0 rounded-full bg-fill" />
      <Icon className="relative size-4 text-text-2" strokeWidth={2} />
    </span>
  );
}
