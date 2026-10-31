import { __test, cleanPhone, whatsappLink } from './coaching';

describe('cleanPhone', () => {
  it('keeps the numbers people type', () => {
    expect(cleanPhone('+91 98765 43210')).toBe('+91 98765 43210');
    expect(cleanPhone('9876543210')).toBe('9876543210');
    expect(cleanPhone('098765-43210')).toBe('09876543210');
  });
  it('rejects too short, too long and misplaced plus signs', () => {
    expect(cleanPhone('98765')).toBeNull();
    expect(cleanPhone('1234567890123456')).toBeNull();
    expect(cleanPhone('91+9876543210')).toBeNull();
    expect(cleanPhone('++919876543210')).toBeNull();
  });
});

describe('get_my_coaching answers', () => {
  it('reads an active member with an intake', () => {
    const s = __test.parse({
      active: true,
      expires_at: '2026-12-01T00:00:00Z',
      coach_name: 'Coach',
      coach_whatsapp: '919876543210',
      intake: { phone: '9876543210', goal: 'Lose 5 kg', schedule: '', notes: '', updated_at: null },
    });
    expect(s.active).toBe(true);
    expect(s.coachWhatsapp).toBe('919876543210');
    expect(s.intake?.goal).toBe('Lose 5 kg');
  });
  it('drops a malformed WhatsApp number and handles empty answers', () => {
    expect(__test.parse({ active: true, coach_whatsapp: '+91 98' }).coachWhatsapp).toBeNull();
    expect(__test.parse(null)).toMatchObject({ active: false, intake: null, coachName: null });
  });
});

it('links to WhatsApp with an editable hello', () => {
  expect(whatsappLink('919876543210', 'Arjun')).toBe(
    'https://wa.me/919876543210?text=Hi%20Arjun%2C%20I%20joined%201%3A1%20coaching%20on%20Overload.',
  );
});
