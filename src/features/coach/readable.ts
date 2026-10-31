const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

/**
 * Makes an answer easy to read even when the AI writes the way data is stored: 2026-10-14
 * becomes "14th October, 2026" (no year when it is this year), and "87.5 kg x 5" becomes
 * "87.5 kg × 5".
 */
export function readable(text: string, now = new Date()): string {
  return text
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (whole, y: string, m: string, d: string) => {
      const month = MONTHS[Number(m) - 1];
      if (!month) return whole;
      const day = `${ordinal(Number(d))} ${month}`;
      return Number(y) === now.getFullYear() ? day : `${day}, ${y}`;
    })
    .replace(/(\d|kg|lb)\s?x\s?(\d)/g, '$1 × $2');
}
