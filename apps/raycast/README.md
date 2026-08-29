# Toss Raycast Extension

Upload the file selected in Finder to Toss and copy the share link to your clipboard.

## Setup

1. Install dependencies:

   ```bash
   cd apps/raycast
   npm install
   ```

2. Start the dev server:

   ```bash
   npm run dev
   ```

3. Open Raycast and run **Share File**.

4. In Raycast → Extensions → Toss → Preferences, set:
   - **Web App URL** — `https://toss.bramsuurd.nl` (production) or `http://localhost:5173` (local dev). The API URL is derived automatically (`https://api.<web-host>` in production, port `3001` locally). For unlimited uploads, append `?k=<INTERNAL_API_KEY>` to this URL (the query param is stripped from copied share links).
   - **Link validity** — default retention for uploads

## Usage

1. Select a file in Finder.
2. Open Raycast and run **Share File** (assign a hotkey in Raycast preferences if you like).
3. The file uploads via the Toss API; the share link is copied to your clipboard.

## Local development

With Toss running locally (`bun run dev` from the repo root), set **Web App URL** to `http://localhost:5173`. The extension calls the API at `http://localhost:3001`.

This package is not part of the Bun workspace (use `npm install` here, not `bun install` from the repo root). It depends on `@transferflow/shared` via `file:../../packages/shared`. Raycast extensions rely on the Ray CLI and npm lockfile.

The extension calls the API with Node `fetch`, so browser CORS does not apply.

## Publishing to the Raycast Store

`ray publish` opens a PR on [raycast/extensions](https://github.com/raycast/extensions). It only proceeds when your **committed** extension differs from what is already on your fork (from an open or merged PR).

If you see `seems like there is nothing new to publish`:

1. Commit and push your changes (including `CHANGELOG.md` with a new `## [...] - {PR_MERGE_DATE}` section).
2. Run `ray publish --verbose` again.
3. If it still fails, check GitHub for an existing PR from a previous publish — update that branch or merge it first.

```bash
git add apps/raycast
git commit -m "raycast: drop API URL preference, default toss.bramsuurd.nl"
ray publish --verbose
```
