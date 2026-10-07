import { checkBirthDate, partsFromIso } from './birthDate';

const today = new Date(2026, 9, 7);
const check = (day: string, month: string, year: string) =>
  checkBirthDate({ day, month, year }, today);

describe('birth date parts', () => {
  it('gives an ISO date and age once complete', () => {
    expect(check('14', '03', '1996')).toEqual({ ok: true, iso: '1996-03-14', age: 30 });
    expect(check('08', '10', '2004')).toEqual({ ok: true, iso: '2004-10-08', age: 21 });
    expect(check('07', '10', '2004')).toEqual({ ok: true, iso: '2004-10-07', age: 22 });
  });

  it('stays quiet while typing and explains real mistakes', () => {
    expect(check('', '', '')).toEqual({ ok: false, error: null });
    expect(check('14', '0', '')).toEqual({ ok: false, error: null });
    expect(check('14', '03', '199')).toEqual({ ok: false, error: null });
    expect(check('32', '', '')).toEqual({ ok: false, error: 'Day is 1 to 31.' });
    expect(check('10', '13', '')).toEqual({ ok: false, error: 'Month is 1 to 12.' });
    expect(check('31', '02', '2000')).toEqual({
      ok: false,
      error: 'February has no day 31.',
    });
    expect(check('01', '01', '2030')).toEqual({ ok: false, error: 'That date is in the future.' });
  });

  it('reads an ISO date back into parts', () => {
    expect(partsFromIso('1996-03-14')).toEqual({ day: '14', month: '03', year: '1996' });
    expect(partsFromIso('')).toEqual({ day: '', month: '', year: '' });
  });
});
