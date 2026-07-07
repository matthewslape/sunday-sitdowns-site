# Sunday Sit Downs

A private, password-protected podcast & vodcast site for the family. Dark, warm, editorial — built as a single-page React app with no backend required to run.

## Stack

- **React 18 + Vite** — the whole app lives in `src/App.jsx`
- **Audio hosting:** direct file URLs (Cloudflare R2 recommended — free tier, zero egress fees). Supports `.mp3` and `.m4a`.
- **Video hosting:** YouTube Unlisted/Private links, embedded via privacy-friendly `youtube-nocookie.com`
- **Email notifications:** EmailJS (configured in the app's Admin → Settings)
- **Storage:** browser `localStorage` via the shim in `src/storage.js` (see limitation below)

## Run it locally

```bash
npm install
npm run dev
```

Open the printed `localhost` URL. Default passwords: listener `family2024`, admin `admin123` — change both in Admin → Settings before sharing.

## Build & deploy

```bash
npm run build
```

This produces a `dist/` folder of static files. Deploy it anywhere that serves static sites:

- **Cloudflare Pages** (recommended — same account as your R2 audio): connect this GitHub repo, framework preset *Vite*, build command `npm run build`, output directory `dist`.
- **Netlify / Vercel:** same settings, or drag-and-drop the `dist` folder into Netlify for a zero-config first deploy.

## ⚠️ Important limitation: storage is per-browser

`src/storage.js` swaps the original environment's storage API for `localStorage`. That means **data is not shared between visitors** — episodes you post as admin exist only in *your* browser. This is fine for testing the design, players, and flows. Before the family actually uses it, replace `src/storage.js` with a shared backend (Cloudflare Workers KV pairs naturally with Pages; Supabase or Firebase also work) keeping the same four methods: `get`, `set`, `delete`, `list`.

## Episode hosting cheat-sheet

- **Audio (Podcast):** upload `.mp3`/`.m4a` to your R2 bucket → copy the public URL → paste into the episode's *Audio file URL* field. For production use a custom domain on the bucket, not the rate-limited `r2.dev` URL. If audio won't play from your site, add a CORS policy to the bucket allowing `GET`/`HEAD` from your site's origin.
- **Video (Vodcast):** upload to YouTube as *Unlisted* or *Private* → paste the share link into the episode's *YouTube link* field.

## Repo layout

```
index.html            entry page (fonts, favicon, #root)
src/main.jsx          mounts the app; loads the storage shim first
src/App.jsx           the entire application
src/storage.js        localStorage shim (replace for multi-user)
public/favicon.svg    the SS icon (boxed tile — app-icon use only)
docs/brand-guide.html the interactive brand guide (open directly in a browser)
```

## Brand rules (short version)

Full guide: `docs/brand-guide.html`.

- The SS monogram appears **solo** (no box) in headers — never boxed-icon-next-to-text.
- The boxed icon is for app tiles/favicons only.
- Wordmark and script lockups stand alone.
- Headings: Cormorant Garamond. UI: Inter. Color: warm accents used sparingly on near-black.
