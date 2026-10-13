import { unzipSync, strFromU8 } from 'fflate';
import { parseCsv, tableFromRows, type CsvTable } from './csv';
import { ImportFormatError } from './formats';

/**
 * Turns a chosen file into a table, whatever Excel or a phone did to it:
 * - .xlsx (and .xlsm): a zip of XML. The first sheet is read; dates Excel stored as serial
 *   numbers are left as numbers and read by parseExportDate.
 * - CSV saved by Excel as UTF-8 (with a BOM), UTF-16 "Unicode text" (tabs), or the system
 *   code page, with commas, semicolons or tabs.
 * - Old .xls files are a closed binary format: the person is asked to save as .xlsx or CSV.
 */
export function readTableFile(name: string, bytes: Uint8Array): CsvTable {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return readXlsx(name, bytes);
  }
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    throw new ImportFormatError(
      `${name} is an old Excel file (.xls). Open it in Excel or Google Sheets and save it as .xlsx or CSV, then choose it again.`,
    );
  }
  return parseCsv(decodeText(bytes));
}

export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  // Not UTF-8 (Excel on Windows saves CSV in the system code page): fall back to Windows-1252.
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(bytes) : utf8;
}

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function unescapeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === '#') {
      const code =
        e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    }
    return ENTITY[e.toLowerCase()] ?? '';
  });
}

/** All the text runs inside an element, joined: rich text in Excel is split into runs. */
function textOf(xml: string): string {
  let out = '';
  for (const m of xml.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)) out += m[1];
  // Phonetic runs (<rPh>) carry readings for East Asian text, not the cell's value.
  return unescapeXml(out);
}

/** "AB12" to 27 (zero-based column). */
function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '').toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readXlsx(name: string, bytes: Uint8Array): CsvTable {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) =>
        f.name === 'xl/workbook.xml' ||
        f.name === 'xl/_rels/workbook.xml.rels' ||
        f.name === 'xl/sharedStrings.xml' ||
        f.name.startsWith('xl/worksheets/'),
    });
  } catch {
    throw new ImportFormatError(`${name} could not be opened. Save it again as .xlsx or CSV.`);
  }
  const text = (path: string) => (files[path] ? strFromU8(files[path]) : null);

  // The first sheet, in the order the workbook lists them.
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const workbook = text('xl/workbook.xml');
  const rels = text('xl/_rels/workbook.xml.rels');
  const firstSheet = workbook ? /<(?:\w+:)?sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook) : null;
  if (firstSheet && rels) {
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
      const target = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
      if (id === firstSheet[1] && target) {
        sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
      }
    }
  }
  const sheet =
    text(sheetPath) ??
    Object.keys(files)
      .filter((f) => f.startsWith('xl/worksheets/') && f.endsWith('.xml'))
      .sort()
      .map(text)[0];
  if (!sheet) throw new ImportFormatError(`${name} has no sheet to read.`);

  const shared: string[] = [];
  const sst = text('xl/sharedStrings.xml');
  if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textOf(m[1]!));

  const rows: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    let next = 0;
    for (const c of rowMatch[2]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1]!;
      const body = c[2] ?? '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const col = ref ? columnIndex(ref) : next;
      next = col + 1;
      const type = /\bt="(\w+)"/.exec(attrs)?.[1] ?? 'n';
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textOf(body);
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else if (type === 'e') value = '';
      else value = v !== undefined ? unescapeXml(v) : '';
      while (row.length < col) row.push('');
      row[col] = value;
    }
    const r = /\br="(\d+)"/.exec(rowMatch[1]!)?.[1];
    // Keep row positions when Excel skips empty rows; tableFromRows drops blank ones.
    if (r) while (rows.length < Number(r) - 1) rows.push([]);
    rows.push(row);
  }
  return tableFromRows(rows);
}
