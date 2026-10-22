import { parseQuantity } from './quantity';
import type { UnitId } from './types';

const dal = {
  units: ['katori', 'ladle', 'cup', 'g'] as UnitId[],
  pieceName: null,
  density: 1.02,
};
const roti = {
  units: ['piece', 'g'] as UnitId[],
  pieceName: ['roti', 'rotis'] as [string, string],
  density: 0.6,
};
const whey = {
  units: ['serving', 'g'] as UnitId[],
  pieceName: ['scoop', 'scoops'] as [string, string],
  density: 0.5,
};

describe('parseQuantity', () => {
  it('keeps the chosen unit when only a number is typed', () => {
    expect(parseQuantity('150', dal, 'g')).toMatchObject({ amount: 150, unit: 'g' });
    expect(parseQuantity('1.5', dal, 'katori')).toMatchObject({ amount: 1.5, unit: 'katori' });
    expect(parseQuantity('1,5', dal, 'katori')).toMatchObject({ amount: 1.5 });
  });

  it('reads grams, kilograms and millilitres into grams', () => {
    expect(parseQuantity('150g', dal, 'katori')).toMatchObject({ amount: 150, unit: 'g' });
    expect(parseQuantity('150 gm', dal, 'katori')).toMatchObject({ amount: 150, unit: 'g' });
    expect(parseQuantity('1.5 kg', dal, 'g')).toMatchObject({ amount: 1500, unit: 'g' });
    expect(parseQuantity('250 ml', dal, 'g')).toMatchObject({ amount: 255, unit: 'g' });
    expect(parseQuantity('1 litre', dal, 'g')).toMatchObject({ amount: 1020, unit: 'g' });
  });

  it('reads household units and fractions', () => {
    expect(parseQuantity('2 katori', dal, 'g')).toMatchObject({ amount: 2, unit: 'katori' });
    expect(parseQuantity('1/2 katori', dal, 'g')).toMatchObject({ amount: 0.5, unit: 'katori' });
    expect(parseQuantity('1 1/2 bowls', dal, 'g')).toMatchObject({ amount: 1.5, unit: 'katori' });
    expect(parseQuantity('1½ katori', dal, 'g')).toMatchObject({ amount: 1.5, unit: 'katori' });
    expect(parseQuantity('½ cup', dal, 'g')).toMatchObject({ amount: 0.5, unit: 'cup' });
  });

  it('understands the food’s own piece and serving names', () => {
    expect(parseQuantity('3 rotis', roti, 'g')).toMatchObject({ amount: 3, unit: 'piece' });
    expect(parseQuantity('2 pcs', roti, 'g')).toMatchObject({ amount: 2, unit: 'piece' });
    expect(parseQuantity('2 scoops', whey, 'g')).toMatchObject({ amount: 2, unit: 'serving' });
    expect(parseQuantity('1.5 scoop', whey, 'g')).toMatchObject({ amount: 1.5, unit: 'serving' });
  });

  it('refuses what it cannot read or the food cannot be measured in', () => {
    expect(parseQuantity('', dal, 'g')).toBeNull();
    expect(parseQuantity('abc', dal, 'g')).toBeNull();
    expect(parseQuantity('0', dal, 'g')).toBeNull();
    expect(parseQuantity('2 scoops', dal, 'g')).toBeNull();
    expect(parseQuantity('2 flurbs', dal, 'g')).toBeNull();
    expect(parseQuantity('2 rotis', whey, 'g')).toBeNull();
    expect(parseQuantity('100 ml', { ...dal, units: ['katori'] }, 'katori')).toBeNull();
  });
});
