import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { parseCsvRows } from './csv';
import { dateOrder, localeDateOrder, parseExportDate } from './dates';
import { ImportFormatError, readExport } from './formats';
import { readTableFile } from './spreadsheet';

const csvText = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');
const fromCsv = (name: string) => readExport([{ name, text: csvText(name) }], { strongUnit: 'kg' });

const pad = (n: number) => String(n).padStart(2, '0');
const colName = (i: number) => String.fromCharCode(65 + i);
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Builds an .xlsx the way Excel saves one: shared strings, numbers, and dates as serials. */
function toXlsx(rows: string[][], dateColumns: number[]): Uint8Array {
  const shared: string[] = [];
  const sheetRows = rows.map((row, r) => {
    const cells = row.map((value, c) => {
      const ref = `${colName(c)}${r + 1}`;
      if (value === '') return '';
      const date = r > 0 && dateColumns.includes(c) ? parseExportDate(value) : null;
      if (date) {
        const serial =
          (Date.UTC(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            date.getHours(),
            date.getMinutes(),
            date.getSeconds(),
          ) -
            Date.UTC(1899, 11, 30)) /
          86_400_000;
        return `<c r="${ref}" s="1"><v>${serial}</v></c>`;
      }
      if (r > 0 && /^-?\d+(\.\d+)?$/.test(value)) return `<c r="${ref}"><v>${value}</v></c>`;
      shared.push(value);
      return `<c r="${ref}" t="s"><v>${shared.length - 1}</v></c>`;
    });
    return `<row r="${r + 1}">${cells.join('')}</row>`;
  });
  return zipSync({
    'xl/workbook.xml': strToU8(
      '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Workouts" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    'xl/sharedStrings.xml': strToU8(
      `<sst>${shared.map((s) => `<si><t xml:space="preserve">${xml(s)}</t></si>`).join('')}</sst>`,
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `<worksheet><sheetData>${sheetRows.join('')}</sheetData></worksheet>`,
    ),
  });
}

describe('spreadsheets and Excel copies', () => {
  it('reads a Hevy export saved as .xlsx exactly like the CSV', () => {
    const rows = parseCsvRows(csvText('hevy-workouts.csv'));
    const dateCols = ['start_time', 'end_time'].map((h) => rows[0]!.indexOf(h));
    const table = readTableFile('workouts.xlsx', toXlsx(rows, dateCols));
    const fromXlsx = readExport([{ name: 'workouts.xlsx', table }], { strongUnit: 'kg' });
    const csv = fromCsv('hevy-workouts.csv');
    expect(fromXlsx.workouts.length).toBe(csv.workouts.length);
    expect(fromXlsx.workouts.map((w) => w.startedAt)).toEqual(csv.workouts.map((w) => w.startedAt));
    expect(fromXlsx.workouts.flatMap((w) => w.exercises.flatMap((e) => e.sets))).toEqual(
      csv.workouts.flatMap((w) => w.exercises.flatMap((e) => e.sets)),
    );
  });

  it('reads a Strong export saved as .xlsx', () => {
    const rows = parseCsvRows(csvText('strong.csv'));
    const table = readTableFile('strong.xlsx', toXlsx(rows, [rows[0]!.indexOf('Date')]));
    const log = readExport([{ name: 'strong.xlsx', table }], { strongUnit: 'kg' });
    expect(log.source).toBe('strong');
    expect(log.workouts.length).toBe(fromCsv('strong.csv').workouts.length);
  });

  it('reads a CSV that Excel rewrote with its own dates, either order', () => {
    const csv = fromCsv('hevy-workouts.csv');
    const rewrite = (fmt: (d: Date) => string, dateOrder?: 'mdy') => {
      const rows = parseCsvRows(csvText('hevy-workouts.csv'));
      const cols = ['start_time', 'end_time'].map((h) => rows[0]!.indexOf(h));
      const text = rows
        .map((row, r) =>
          row
            .map((v, c) => (r > 0 && cols.includes(c) ? fmt(parseExportDate(v)!) : v))
            .map((v) => `"${v.replace(/"/g, '""')}"`)
            .join(','),
        )
        .join('\r\n');
      return readExport([{ name: 'w.csv', text }], { strongUnit: 'kg', dateOrder });
    };
    const dmy = rewrite(
      (d) =>
        `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
    );
    expect(dmy.workouts.map((w) => w.startedAt)).toEqual(csv.workouts.map((w) => w.startedAt));
    const h12 = (d: Date) =>
      `${d.getHours() % 12 || 12}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
    // These two dates read both ways, so the device's own convention decides.
    const mdy = rewrite(
      (d) => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${h12(d)}`,
      'mdy',
    );
    expect(mdy.workouts.map((w) => w.startedAt)).toEqual(csv.workouts.map((w) => w.startedAt));
  });

  it('works out day-first or month-first from the column', () => {
    expect(dateOrder(['03/04/2026', '25/04/2026'])).toBe('dmy');
    expect(dateOrder(['03/04/2026', '04/25/2026'])).toBe('mdy');
    // Every date fits both ways: the reading that keeps the rows in order wins.
    expect(dateOrder(['01/02/2026', '01/03/2026', '01/04/2026', '02/01/2026'])).toBe('mdy');
    expect(dateOrder(['01/02/2026', '02/02/2026', '03/02/2026', '01/03/2026'])).toBe('dmy');
    expect(dateOrder(['03/04/2026'], 'mdy')).toBe('mdy');
    expect(localeDateOrder('en-US')).toBe('mdy');
    expect(localeDateOrder('en-IN')).toBe('dmy');
    expect(parseExportDate('12-Oct-26 19:07')).toEqual(new Date(2026, 9, 12, 19, 7));
    expect(parseExportDate('46307.5')).toEqual(new Date(2026, 9, 12, 12, 0));
  });

  it('reads UTF-16 tab-separated text, as Excel saves Unicode text', () => {
    const text = csvText('hevy-workouts.csv');
    const tsv = parseCsvRows(text)
      .map((r) => r.join('\t'))
      .join('\r\n');
    const body = new Uint8Array(2 + tsv.length * 2);
    body[0] = 0xff;
    body[1] = 0xfe;
    for (let i = 0; i < tsv.length; i++) {
      const code = tsv.charCodeAt(i);
      body[2 + i * 2] = code & 0xff;
      body[3 + i * 2] = code >> 8;
    }
    const table = readTableFile('workouts.txt', body);
    const log = readExport([{ name: 'workouts.txt', table }], { strongUnit: 'kg' });
    expect(log.workouts.length).toBe(fromCsv('hevy-workouts.csv').workouts.length);
  });

  it('explains what to do with an old .xls file', () => {
    const xls = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(() => readTableFile('old.xls', xls)).toThrow(ImportFormatError);
    expect(() => readTableFile('old.xls', xls)).toThrow(/save it as .xlsx or CSV/);
  });
});
