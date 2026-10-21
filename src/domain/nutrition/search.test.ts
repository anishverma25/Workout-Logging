import { FOODS } from '@/data/library/foods';
import { parseMeal } from './parse';
import { phonetic, searchFoods } from './search';

const top = (q: string, diet: Parameters<typeof searchFoods>[2] = null) =>
  searchFoods(FOODS, q, diet)[0]?.id;

describe('food search', () => {
  it('understands Hinglish spellings', () => {
    expect(phonetic('daal')).toBe(phonetic('dal'));
    expect(phonetic('dhal')).toBe(phonetic('dal'));
    expect(top('daal')).toBe('dal-tadka');
    expect(top('dhal')).toBe('dal-tadka');
    expect(top('chawal')).toBe('rice');
    expect(top('bhindi')).toBe('bhindi');
    expect(top('okra')).toBe('bhindi');
    expect(top('dahi')).toBe('curd');
    expect(top('chapati')).toBe('roti');
    expect(top('aloo gobi')).toBe('aloo-gobhi');
    expect(top('anda')).toBe('boiled-egg');
  });

  it('respects the diet', () => {
    expect(searchFoods(FOODS, 'chicken', 'veg')).toHaveLength(0);
    expect(searchFoods(FOODS, 'omelette', 'veg')).toHaveLength(0);
    expect(top('omelette', 'egg')).toBe('omelette');
    expect(searchFoods(FOODS, 'aloo', 'jain')).toHaveLength(0);
  });
});

describe('typing a meal', () => {
  it('turns a sentence into foods and amounts', () => {
    const m = parseMeal('2 roti dal aloo gobhi', FOODS);
    expect(m.items.map((i) => [i.food.id, i.amount])).toEqual([
      ['roti', 2],
      ['dal-tadka', 1],
      ['aloo-gobhi', 1],
    ]);
    expect(m.unknown).toEqual([]);
  });

  it('reads units, Hindi numbers and joining words', () => {
    const m = parseMeal('ek katori rajma aur chawal, 1 glass chaas', FOODS);
    expect(m.items.map((i) => [i.food.id, i.amount, i.unit])).toEqual([
      ['rajma', 1, 'katori'],
      ['rice', 1, null],
      ['chaas', 1, 'glass'],
    ]);
  });

  it('reads grams and leaves out what it does not know', () => {
    const m = parseMeal('150g paneer and pizza', FOODS);
    expect(m.items).toHaveLength(1);
    expect(m.items[0]).toMatchObject({ amount: 150, unit: 'g' });
    expect(m.items[0]!.food.id).toBe('paneer');
    expect(m.unknown).toEqual(['pizza']);
  });
});
