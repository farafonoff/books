import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const goodreadsExportFile = path.join(repoRoot, 'exports', 'goodreads_library_export.csv');
const sourceFiles = [
  'books.md',
  'cormoran-strike.md',
  'donna-tartt.md',
  'fandorin.md',
  'harry-potter.md',
  'neal-stephenson.md',
];

const mergedHeader = [
  'Book Id',
  'Title',
  'Author',
  'Author l-f',
  'Additional Authors',
  'ISBN',
  'ISBN13',
  'My Rating',
  'Publisher',
  'Binding',
  'Number of Pages',
  'Year Published',
  'Original Publication Year',
  'Date Read',
  'Date Added',
  'Bookshelves',
  'Bookshelves with positions',
  'Exclusive Shelf',
  'My Review',
  'Spoiler',
  'Private Notes',
  'Read Count',
  'Owned Copies',
  'Base Title',
  'Base Author',
  'Base Status',
  'Base Tags',
  'Base Vibe',
  'Base Difficulty',
  'Base Notes',
  'Base Good',
  'Base Bad',
  'Merge Source',
];

function parseScalar(rawValue) {
  const value = rawValue.trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    return value;
  }

  if (value.startsWith('"')) {
    return value.endsWith('"') ? value.slice(1, -1) : value.slice(1);
  }

  return value;
}

function parseMarkdownBlocks(fileContent) {
  return fileContent
    .split(/^---\s*$/m)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const entry = {};
      for (const line of block.split('\n')) {
        const match = line.match(/^([a-z-]+):\s*(.*)$/i);
        if (!match) {
          continue;
        }

        const [, key, rawValue] = match;
        entry[key] = parseScalar(rawValue);
      }
      return entry;
    })
    .filter((entry) => entry.title && entry.author && entry.status);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function csvEscape(value) {
  const stringValue = value ?? '';
  return `"${String(stringValue).replace(/"/g, '""')}"`;
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .toLowerCase()
    .trim();
}

function titleKey(title) {
  return normalizeText(title).replace(/\s+/g, ' ');
}

function parseQuotedList(rawList) {
  const matches = String(rawList ?? '').match(/"([^"]+)"/g) ?? [];
  return matches.map((item) => item.replace(/^"|"$/g, ''));
}

function parseMarkdownList(rawList) {
  const text = String(rawList ?? '').trim();
  if (!text || text === '[]') {
    return [];
  }

  return parseQuotedList(text);
}

function buildBookshelves(entry) {
  return parseMarkdownList(entry.tags).join(' ');
}

function buildBaseReview(entry) {
  const parts = [];

  if (entry.notes) {
    parts.push(entry.notes);
  }
  if (entry.good) {
    parts.push(`Good: ${entry.good}`);
  }
  if (entry.bad) {
    parts.push(`Bad: ${entry.bad}`);
  }

  return parts.join(' | ');
}

function statusToShelf(status) {
  switch (status) {
    case 'done':
      return 'read';
    case 'reading':
      return 'currently-reading';
    case 'want-to-read':
    case 'to-read':
      return 'to-read';
    case 'dropped':
    case 'abort':
      return 'read';
    default:
      return 'to-read';
  }
}

function authorLastFirst(author) {
  const parts = String(author ?? '').split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return author;
  }

  const last = parts.at(-1);
  const rest = parts.slice(0, -1).join(' ');
  return `${last}, ${rest}`;
}

const rawGoodreads = fs.readFileSync(goodreadsExportFile, 'utf8');
const goodreadsRows = parseCsv(rawGoodreads);
const goodreadsHeader = goodreadsRows.shift();
const goodreadsEntries = goodreadsRows.map((row) => {
  const entry = {};
  for (let index = 0; index < goodreadsHeader.length; index += 1) {
    entry[goodreadsHeader[index]] = row[index] ?? '';
  }
  return entry;
});

const baseEntries = [];
for (const relativeFile of sourceFiles) {
  const absoluteFile = path.join(repoRoot, relativeFile);
  const fileContent = fs.readFileSync(absoluteFile, 'utf8');
  const entries = parseMarkdownBlocks(fileContent);
  for (const entry of entries) {
    baseEntries.push({ ...entry, sourceFile: relativeFile });
  }
}

const baseByTitle = new Map();
for (const entry of baseEntries) {
  const key = titleKey(entry.title);
  if (!baseByTitle.has(key)) {
    baseByTitle.set(key, entry);
  }
}

const matchedBaseKeys = new Set();
const mergedRows = [];

for (const goodreadsEntry of goodreadsEntries) {
  const key = titleKey(goodreadsEntry.Title);
  const baseEntry = baseByTitle.get(key);
  if (baseEntry) {
    matchedBaseKeys.add(key);
  }

  mergedRows.push({
    'Book Id': goodreadsEntry['Book Id'],
    Title: goodreadsEntry.Title,
    Author: goodreadsEntry.Author,
    'Author l-f': goodreadsEntry['Author l-f'],
    'Additional Authors': goodreadsEntry['Additional Authors'],
    ISBN: goodreadsEntry.ISBN,
    ISBN13: goodreadsEntry.ISBN13,
    'My Rating': goodreadsEntry['My Rating'],
    Publisher: goodreadsEntry.Publisher,
    Binding: goodreadsEntry.Binding,
    'Number of Pages': goodreadsEntry['Number of Pages'],
    'Year Published': goodreadsEntry['Year Published'],
    'Original Publication Year': goodreadsEntry['Original Publication Year'],
    'Date Read': goodreadsEntry['Date Read'],
    'Date Added': goodreadsEntry['Date Added'],
    Bookshelves: goodreadsEntry.Bookshelves,
    'Bookshelves with positions': goodreadsEntry['Bookshelves with positions'],
    'Exclusive Shelf': goodreadsEntry['Exclusive Shelf'],
    'My Review': goodreadsEntry['My Review'],
    Spoiler: goodreadsEntry.Spoiler,
    'Private Notes': goodreadsEntry['Private Notes'],
    'Read Count': goodreadsEntry['Read Count'],
    'Owned Copies': goodreadsEntry['Owned Copies'],
    'Base Title': baseEntry?.title ?? '',
    'Base Author': baseEntry?.author ?? '',
    'Base Status': baseEntry?.status ?? '',
    'Base Tags': baseEntry ? buildBookshelves(baseEntry) : '',
    'Base Vibe': baseEntry?.vibe ?? '',
    'Base Difficulty': baseEntry?.difficulty ?? '',
    'Base Notes': baseEntry?.notes ?? '',
    'Base Good': baseEntry?.good ?? '',
    'Base Bad': baseEntry?.bad ?? '',
    'Merge Source': baseEntry ? 'goodreads+base' : 'goodreads-only',
  });
}

for (const baseEntry of baseEntries) {
  const key = titleKey(baseEntry.title);
  if (matchedBaseKeys.has(key)) {
    continue;
  }

  mergedRows.push({
    'Book Id': '',
    Title: baseEntry.title,
    Author: baseEntry.author,
    'Author l-f': authorLastFirst(baseEntry.author),
    'Additional Authors': '',
    ISBN: '',
    ISBN13: '',
    'My Rating': '',
    Publisher: '',
    Binding: '',
    'Number of Pages': '',
    'Year Published': '',
    'Original Publication Year': '',
    'Date Read': '',
    'Date Added': '',
    Bookshelves: buildBookshelves(baseEntry),
    'Bookshelves with positions': '',
    'Exclusive Shelf': statusToShelf(baseEntry.status),
    'My Review': buildBaseReview(baseEntry),
    Spoiler: '',
    'Private Notes': '',
    'Read Count': '',
    'Owned Copies': '',
    'Base Title': baseEntry.title,
    'Base Author': baseEntry.author,
    'Base Status': baseEntry.status,
    'Base Tags': buildBookshelves(baseEntry),
    'Base Vibe': parseMarkdownList(baseEntry.vibe).join(' '),
    'Base Difficulty': baseEntry.difficulty ?? '',
    'Base Notes': baseEntry.notes ?? '',
    'Base Good': baseEntry.good ?? '',
    'Base Bad': baseEntry.bad ?? '',
    'Merge Source': 'base-only',
  });
}

const outputDir = path.join(repoRoot, 'exports');
const outputFile = path.join(outputDir, 'goodreads_library_merged.csv');
fs.mkdirSync(outputDir, { recursive: true });

const csvRows = [
  mergedHeader.join(','),
  ...mergedRows.map((row) => mergedHeader.map((column) => csvEscape(row[column])).join(',')),
];
const csv = csvRows.join('\n');
fs.writeFileSync(outputFile, `${csv}\n`, 'utf8');

console.log(`Merged ${goodreadsEntries.length} Goodreads rows with ${baseEntries.length} base rows -> ${path.relative(repoRoot, outputFile)}`);