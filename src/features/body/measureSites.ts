import { MEASUREMENT_LABELS } from '@/data/repositories/measurements';
import type { MeasurementField, Sex } from '@/domain/models/schemas';

/** Where to measure, so readings stay comparable from week to week. */
export const HOW: Record<MeasurementField, string> = {
  waistCm: 'At the navel, relaxed, after breathing out',
  neckCm: 'Just below the Adam’s apple',
  hipCm: 'Widest point of the hips and glutes',
  chestCm: 'Across the nipples, arms down',
  armCm: 'Flexed, at the peak of the biceps',
  thighCm: 'Halfway between hip and knee',
  calfCm: 'Widest point',
  shouldersCm: 'Around the widest point, arms relaxed',
  forearmCm: 'Widest point, arm straight and relaxed',
  wristCm: 'Just above the wrist bone',
  underbustCm: 'Snug, directly under the bust',
  armRightCm: 'Flexed, at the peak of the biceps',
  forearmRightCm: 'Widest point, arm straight and relaxed',
  thighRightCm: 'Halfway between hip and knee',
  calfRightCm: 'Widest point',
};

/** The right side of each part measured on both sides. */
export const RIGHT_OF: Partial<Record<MeasurementField, MeasurementField>> = {
  armCm: 'armRightCm',
  forearmCm: 'forearmRightCm',
  thighCm: 'thighRightCm',
  calfCm: 'calfRightCm',
};
export const RIGHT_FIELDS = new Set(Object.values(RIGHT_OF));

/**
 * The sites to measure, in groups. Women get the bust and under-bust, men the chest; waist,
 * neck (and hips for women) come first because they give the body-fat estimate.
 */
export function measurementGroups(sex: Sex | null): { title: string; fields: MeasurementField[] }[] {
  const female = sex === 'female';
  return [
    {
      title: 'For the body-fat estimate',
      fields: female ? ['waistCm', 'neckCm', 'hipCm'] : ['waistCm', 'neckCm'],
    },
    {
      title: 'Upper body',
      fields: female
        ? ['shouldersCm', 'chestCm', 'underbustCm', 'armCm', 'forearmCm', 'wristCm']
        : ['shouldersCm', 'chestCm', 'armCm', 'forearmCm', 'wristCm'],
    },
    {
      title: 'Lower body',
      fields: female ? ['thighCm', 'calfCm'] : ['hipCm', 'thighCm', 'calfCm'],
    },
  ];
}

export function measurementLabel(f: MeasurementField, sex: Sex | null, bothSides = false) {
  if (f === 'chestCm' && sex === 'female') return 'Bust';
  if (bothSides && RIGHT_OF[f]) return `Left ${MEASUREMENT_LABELS[f].toLowerCase()}`;
  return MEASUREMENT_LABELS[f];
}

