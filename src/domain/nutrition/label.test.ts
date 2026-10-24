import { dietFromName, labelAddsUp, labelPortion } from './label';

const whey = { kcal: 400, proteinG: 80, carbsG: 8, fatG: 6, fibreG: 0 };
const scoop = { kcal: 132, proteinG: 26.4, carbsG: 2.6, fatG: 2, fibreG: 0 };

describe('a portion from a label', () => {
  it('grams against per 100 g values', () => {
    expect(
      labelPortion({ values: whey, column: 'per100', servingG: 33, amount: 45, unit: 'g' }),
    ).toEqual({ grams: 45, kcal: 180, proteinG: 36, carbsG: 3.6, fatG: 2.7, fibreG: 0 });
  });

  it('servings against per 100 g values, through the serving size', () => {
    expect(
      labelPortion({ values: whey, column: 'per100', servingG: 33, amount: 2, unit: 'serving' }),
    ).toMatchObject({ grams: 66, kcal: 264, proteinG: 52.8 });
  });

  it('servings against per serving values need no serving size', () => {
    expect(
      labelPortion({
        values: scoop,
        column: 'perServing',
        servingG: null,
        amount: 1.5,
        unit: 'serving',
      }),
    ).toMatchObject({ kcal: 198, proteinG: 39.6 });
  });

  it('grams against per serving values use the serving size', () => {
    expect(
      labelPortion({ values: scoop, column: 'perServing', servingG: 33, amount: 66, unit: 'g' }),
    ).toMatchObject({ grams: 66, kcal: 264 });
  });

  it('says nothing rather than guess when something is missing', () => {
    expect(
      labelPortion({ values: scoop, column: 'perServing', servingG: null, amount: 50, unit: 'g' }),
    ).toBeNull();
    expect(
      labelPortion({
        values: { ...whey, kcal: null },
        column: 'per100',
        servingG: 33,
        amount: 30,
        unit: 'g',
      }),
    ).toBeNull();
    expect(
      labelPortion({ values: whey, column: 'per100', servingG: null, amount: 1, unit: 'serving' }),
    ).toBeNull();
  });

  it('notices numbers that do not add up', () => {
    expect(labelAddsUp(whey)).toBe(true);
    expect(labelAddsUp({ ...whey, kcal: 900 })).toBe(false);
  });

  it('guesses the diet from the name', () => {
    expect(dietFromName('Chicken salami')).toBe('nonveg');
    expect(dietFromName('Egg white powder')).toBe('egg');
    expect(dietFromName('Whey protein')).toBe('veg');
  });
});
