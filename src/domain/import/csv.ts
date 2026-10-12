/**
 * A small, strict CSV reader for exports from other workout apps (RFC 4180: quoted fields,
 * doubled quotes inside them, line breaks inside quotes). Strong has shipped both comma and
 * semicolon files over the years, so the delimiter is read from the header line.
 */

export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

function detectDelimiter(text: string): ',' | ';' {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? undefined : text.indexOf('\n'));
  const count = (ch: string) => {
    let n = 0;
    let quoted = false;
    for (const c of firstLine) {
      if (c === '"') quoted = !quoted;
      else if (c === ch && !quoted) n++;
    }
    return n;
  };
  return count(';') > count(',') ? ';' : ',';
}

export function parseCsvRows(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines are not rows.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Rows keyed by header, with headers lowercased and trimmed so small changes do not matter. */
export function parseCsv(text: string): CsvTable {
  const [head, ...body] = parseCsvRows(text);
  const headers = (head ?? []).map((h) => h.trim().toLowerCase());
  return {
    headers,
    rows: body.map((cells) =>
      Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()])),
    ),
  };
}

/** A number from a cell, or null for empty and unreadable cells. Accepts a decimal comma. */
export function num(value: string | undefined): number | null {
  if (value === undefined) return null;
  const v = value.trim().replace(/\s/g, '');
  if (v === '') return null;
  const n = Number(/^-?\d+,\d+$/.test(v) ? v.replace(',', '.') : v);
  return Number.isFinite(n) ? n : null;
}
