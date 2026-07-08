// Replace the __SITE_URL__ placeholder in the built index.html with the
// deploy's absolute URL so Open Graph / Twitter tags resolve for scrapers
// (iMessage, WhatsApp, Slack, etc. require absolute og:image / og:url).
//
// Netlify sets $URL to the site's primary address at build time; if you later
// point a custom domain at the site and make it primary, this updates
// automatically. Falls back to a relative path when no URL is available (local
// builds) — previews still work on platforms that resolve relative og:image.
import { readFileSync, writeFileSync } from "node:fs";

const file = "dist/index.html";
const url = (process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/$/, "");

let html = readFileSync(file, "utf8");
html = html.replaceAll("__SITE_URL__", url);
writeFileSync(file, html);

console.log(`inject-site-url: ${url ? `using ${url}` : "no $URL — relative fallback"}`);
