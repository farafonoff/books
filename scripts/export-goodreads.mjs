import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sourceFiles = [
  'books.md',
  'cormoran-strike.md',
  'donna-tartt.md',
  'fandorin.md',
  'harry-potter.md',
  'neal-stephenson.md',
];

const header = [
  'Title',
  'Author',
  'ISBN',
  'My Rating',
  'Average Rating',
  'Publisher',
  'Binding',
  'Year Published',
  'Original Publication Year',
  'Date Read',
  'Date Added',
  'Shelves',
  'Bookshelves',
  'My Review',
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

function parseBlocks(fileContent) {
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

function mapStatus(status) {
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

function csvEscape(value) {
  const stringValue = value ?? '';
  return `"${String(stringValue).replace(/"/g, '""')}"`;
}

function extractQuotedItems(rawList) {
  const matches = String(rawList ?? '').match(/"([^"]+)"/g) ?? [];
  return matches.map((item) => item.replace(/^"|"$/g, ''));
}

function buildBookshelves(entry) {
  return extractQuotedItems(entry.tags).join(' ');
}

function buildReview(entry) {
  const parts = [];

  if (entry.series) {
    parts.push(`Series: ${entry.series}`);
  }
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

const rows = [];
for (const relativeFile of sourceFiles) {
  const absoluteFile = path.join(repoRoot, relativeFile);
  const fileContent = fs.readFileSync(absoluteFile, 'utf8');
  const entries = parseBlocks(fileContent);

  for (const entry of entries) {
    rows.push([
      entry.title,
      entry.author,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      mapStatus(entry.status),
      buildBookshelves(entry),
      buildReview(entry),
    ]);
  }
}

const outputDir = path.join(repoRoot, 'exports');
const outputFile = path.join(outputDir, 'goodreads-import.csv');
fs.mkdirSync(outputDir, { recursive: true });

const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
fs.writeFileSync(outputFile, `${csv}\n`, 'utf8');

console.log(`Wrote ${rows.length} rows to ${path.relative(repoRoot, outputFile)}`);