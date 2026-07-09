# Sunday Sit Downs

A private, password-protected podcast & vodcast site for the family. Dark, warm, editorial — built as a single-page React app with no backend required to run.

## Stack

- **React 18 + Vite** — the whole app lives in `src/App.jsx`
- **Audio hosting:** direct file URLs (Cloudflare R2 recommended — free tier, zero egress fees). Supports `.mp3` and `.m4a`.
- **Video hosting:** YouTube Unlisted/Private links, embedded via privacy-friendly `youtube-nocookie.com`
- **Notifications:** free Web Push — family members tap "Turn on notifications" on the Listen page (iPhone: add the site to the Home Screen first), and every saved episode pings their devices via `netlify/functions/store.mjs` + `public/sw.js`. No email/SMS provider needed.
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

## Shared storage (multi-device)

Data lives in a shared backend: a Netlify Function (`netlify/functions/store.mjs`) backed by **Netlify Blobs**. Episodes, subscribers, access requests, and settings are the same for every family member on every device — no extra accounts or configuration needed beyond deploying to Netlify. Passwords are verified server-side and never sent to visitors' browsers.

When the API isn't reachable (e.g. running plain `vite` locally instead of `netlify dev`), the app falls back to the per-browser `localStorage` shim in `src/storage.js`, so local demos still work — just without sharing.

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
