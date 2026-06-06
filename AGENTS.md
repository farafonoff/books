# AGENTS.md

This repository stores a personal reading library in Markdown files.

## Canonical Data

- Primary list: books.md
- Podcast/homework list: zakladka.md
- Series/topic files: cormoran-strike.md, fandorin.md, harry-potter.md, donna-tartt.md, neal-stephenson.md
- Separate child list: son.md

Treat Markdown entries as the source of truth.
Do not duplicate current-reading state in this file.

## Entry Format

Use YAML-like blocks separated by `---`.
Preferred fields:

- title
- author
- status
- tags
- vibe
- difficulty
- notes
- good
- bad

Not all fields are required for every entry, but keep structure consistent.

## Status Conventions

Main statuses used in this repo:

- done
- reading
- want-to-read
- to-read
- dropped
- abort
- skip

When updating progress:

- Move finished books to `done`.
- Keep active books in `reading`.
- Add short context in `notes`, and optional reaction in `good`/`bad`.

## Where To Find Current Reading

Current reading should be inferred from entries with:

- `status: "reading"` in books.md
- `status: "reading"` in zakladka.md

## Export Workflow

Scripts:

- scripts/export-goodreads.mjs
- scripts/merge-goodreads-base.mjs

Outputs:

- exports/goodreads-import.csv
- exports/goodreads_library_merged.csv

Keep Markdown and exported CSVs aligned after batch updates.
