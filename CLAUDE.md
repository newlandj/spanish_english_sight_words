# Spanish/English Sight Words

## Project Overview

A progressive web app (PWA) for learning Spanish/English sight words, built with vanilla HTML, CSS, and JavaScript.

## Project Structure

- `docs/` — Static site files served via GitHub Pages
  - `index.html` — Main app entry point
  - `app.js` — Application logic
  - `style.css` — Styles
  - `words.json` — Sight words data
  - `manifest.json` — PWA manifest
  - `sw.js` — Service worker
- `archive/` — Legacy files, no longer in use
  - `extract_words.py` — Original script to extract words from the reference PDF
  - `sight_words_reference.pdf` — Source PDF that seeded the initial word list

## GitHub Interactions

When on desktop, use the **GitHub CLI (`gh`)** for all GitHub interactions:

```bash
# View issues
gh issue list
gh issue view <number>

# Pull requests
gh pr list
gh pr view <number>
gh pr create
gh pr merge <number>

# Repo info
gh repo view
```

## Development

The app is a static site — no build step required. Edit files in `docs/` directly.

The word list (`docs/words.json`) has evolved beyond the original PDF source and is now maintained directly. The legacy `extract_words.py` script and `sight_words_reference.pdf` have been moved to `archive/` and are no longer used.
