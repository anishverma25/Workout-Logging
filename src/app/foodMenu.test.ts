import { checkMenu, handleFoodMenu, type CoachDeps } from '../../supabase/functions/_shared/coach.ts';
import { FOODS } from '@/data/library/foods';
import { rankMenu } from '@/domain/nutrition/solver';

/** Reading a menu: the AI's part is names only, and no figure leaves the server with them. */
describe('menu photo', () => {
  it('keeps dish names and drops prices, numbers and duplicates', () => {
    expect(
      checkMenu({ dishes: ['Paneer Butter Masala ₹240', 'Dal Tadka 120', 'dal tadka', 'Chicken Tikka (6 pcs)', 'Roti - Rs 15', 42, 'ab'] }),
    ).toEqual(['Paneer Butter Masala', 'Dal Tadka', 'Chicken Tikka', 'Roti']);
    expect(checkMenu({ dishes: [] })).toBeNull();
    expect(checkMenu({ items: ['x'] })).toBeNull();
    for (const name of checkMenu({ dishes: ['Thali 350 kcal 22g protein 199'] })!) expect(name).not.toMatch(/\d/);
  });

  const deps = (over: Partial<CoachDeps> = {}): CoachDeps =>
    ({
      subscription: async () => ({ status: 'active', pro_expires_at: new Date(Date.now() + 86_400_000).toISOString(), server_now: new Date().toISOString() }),
      providers: [{ name: 'gemini', generate: async () => JSON.stringify({ dishes: ['Dal Tadka 120', 'Jeera Rice'] }) }],
      ...over,
    }) as unknown as CoachDeps;
  const body = { kind: 'food_menu', image: 'aGVsbG8=', mime: 'image/jpeg' };

  it('answers Pro members with names only, and refuses everyone else', async () => {
    const ok = await handleFoodMenu(deps(), body);
    expect(ok).toMatchObject({ status: 200, body: { dishes: ['Dal Tadka', 'Jeera Rice'] } });
    const free = await handleFoodMenu(deps({ subscription: async () => ({ status: 'expired', server_now: new Date().toISOString() }) } as never), body);
    expect(free.status).toBe(403);
    const notMenu = await handleFoodMenu(deps({ providers: [{ name: 'gemini', generate: async () => '{"not_a_menu": true}' }] } as never), body);
    expect(notMenu.status).toBe(422);
    expect((await handleFoodMenu(deps(), { ...body, image: '' })).status).toBe(400);
  });

  it('ranks the dishes with the library’s numbers for what is left', () => {
    const matches = rankMenu({
      dishes: ['Paneer Butter Masala', 'Dal Tadka', 'Gulab Jamun', 'Chef Special Zzyx'],
      foods: FOODS,
      remaining: { kcal: 600, proteinG: 40 },
      diet: 'veg',
    });
    expect(matches.find((m) => m.dish === 'Chef Special Zzyx')).toMatchObject({ portion: null, verdict: 'unknown' });
    const dal = matches.find((m) => m.dish === 'Dal Tadka')!;
    expect(dal.portion!.food.id).toBe('dal-tadka');
    expect(matches[0]!.verdict).toBe('best');
    expect(matches.findIndex((m) => m.dish === 'Gulab Jamun')).toBeGreaterThan(matches.findIndex((m) => m.dish === 'Dal Tadka'));
  });
});
