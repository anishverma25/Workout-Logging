import { numbersAgree, sharedToFood } from './sharedFoods';

describe('shared foods', () => {
  it('turns a checked row into a food, and drops rows that cannot be used', () => {
    const food = sharedToFood({
      id: 'a1',
      name: ' Sattu ladoo ',
      diet: 'veg',
      kcal: '400.0',
      protein_g: '33.3',
      carbs_g: '40',
      fat_g: '11.9',
      fibre_g: '2',
      piece_g: '60.0',
    });
    expect(food).toMatchObject({
      id: 'shared-a1',
      name: 'Sattu ladoo',
      source: 'community',
      pieceG: 60,
      units: ['piece', 'g'],
      pieceName: ['serving', 'servings'],
    });
    expect(food!.per100.kcal).toBe(400);
    expect(
      sharedToFood({ id: 'x', name: 'Air', kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }),
    ).toBeNull();
    expect(
      sharedToFood({ id: 'x', name: '', kcal: 100, protein_g: 1, carbs_g: 1, fat_g: 1 }),
    ).toBeNull();
    expect(sharedToFood(null)).toBeNull();
    // An unknown diet is never trusted to be meat-free.
    expect(
      sharedToFood({
        id: 'y',
        name: 'Thing',
        diet: 'meat',
        kcal: 100,
        protein_g: 5,
        carbs_g: 10,
        fat_g: 4,
      })!.diet,
    ).toBe('veg');
  });

  it('checks calories against the macros the way the server does', () => {
    expect(numbersAgree({ kcal: 400, proteinG: 20, carbsG: 50, fatG: 13, fibreG: 0 })).toBe(true);
    expect(numbersAgree({ kcal: 100, proteinG: 30, carbsG: 0, fatG: 40, fibreG: 0 })).toBe(false);
  });
});
