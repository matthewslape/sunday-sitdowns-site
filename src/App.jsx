import { useState, useEffect, useRef, useCallback } from "react";

// ─── Web fonts (Inter for UI, Cormorant Garamond for elegant serif headings) ───
if (typeof document !== "undefined" && !document.getElementById("ssd-fonts")) {
  const l = document.createElement("link");
  l.id = "ssd-fonts";
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700;800;900&display=swap";
  document.head.appendChild(l);
}

// ─── Magic link / token helpers ────────────────────────────────────────────────
function makeToken() {
  const bytes = new Uint8Array(18);
  (window.crypto || {}).getRandomValues?.(bytes);
  return Array.from(bytes, b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}
function getUrlToken() {
  try { return new URLSearchParams(window.location.search).get("key"); }
  catch { return null; }
}
function buildMagicLink(token) {
  let origin = "https://your-podcast-site.com";
  try { if (window.location.origin && !window.location.origin.startsWith("blob")) origin = window.location.origin; }
  catch {}
  return `${origin}/?key=${token}`;
}
const REMEMBER_KEY = "ssd_remembered_token";

// ─── Design Tokens (Sunday Sit Downs brand — MP058 palette, light + dark) ──────
// Structural tokens are CSS variables defined in index.html and flipped by the
// `data-theme` attribute on <html> (see ThemeToggle). Accents are constant hex
// in both themes: they're used with alpha-append and luminance math, and the
// two brand accents (Chinese Lantern, Cassiopeia) read well on either bg.
//
// Palette:  Lynx White #F7F7F7 · Dream Catcher #E5EBEA · Cassiopeia #AED0C9
//           Chinese Lantern #F09056 · Deep Slate Olive #172713 · Sensaimidori #374231
const LANTERN = "#F09056";   // warm accent — HIGHLIGHT ONLY (play/watch, latest, active states)
const CASSIO  = "#AED0C9";   // cool accent — private / success
const SENSAI  = "#374231";   // deep green — occasional secondary accent
const HIGHLIGHT = LANTERN;   // the single highlight color used across interactive accents
const T = {
  bg:       "var(--bg)",
  surface:  "var(--surface)",
  surface2: "var(--surface2)",
  line:     "var(--line)",
  white:    "var(--text)",     // primary text (name kept for existing references)
  gray:     "var(--gray)",
  grayDim:  "var(--grayDim)",

  font:     "'Inter', system-ui, sans-serif",
  serif:    "'Cormorant Garamond', Georgia, serif",  // high-contrast elegant serif for headings

  // Brand accents (constant across themes). Legacy keys are kept as aliases so
  // every existing reference resolves onto the two-accent palette.
  accents: {
    cream:     "#F7F7F7",  // Lynx White
    sand:      LANTERN,    // brand mark / primary CTA — warm pop on both themes
    marigold:  LANTERN,
    vermilion: LANTERN,
    forest:    SENSAI,
    sage:      CASSIO,     // private / confirmations
    // aliases kept so existing references resolve cleanly
    green:     SENSAI,
    sky:       CASSIO,
    turquoise: CASSIO,
    orange:    LANTERN,
    purple:    LANTERN,
    lightGreen:CASSIO,
    blue:      CASSIO,
    yellow:    LANTERN,
    pink:      LANTERN,
    red:       LANTERN,
    cobalt:    CASSIO,
  },
};

// ─── Icons (inline SVG, stroke-based, elegant) ─────────────────────────────────
const Icon = ({ d, size=18, stroke=2, fill="none", color="currentColor", style={} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {Array.isArray(d) ? d.map((p,i)=><path key={i} d={p}/>) : <path d={d}/>}
  </svg>
);
const Icons = {
  play:    "M8 5v14l11-7z",
  pause:   ["M6 4h4v16H6z","M14 4h4v16h-4z"],
  mic:     ["M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z","M19 10v1a7 7 0 0 1-14 0v-1","M12 18v4","M8 22h8"],
  video:   ["M23 7l-7 5 7 5V7z","M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"],
  back15:  ["M1 4v6h6","M3.51 15a9 9 0 1 0 2.13-9.36L1 10"],   // circular skip-back arrow
  fwd15:   ["M23 4v6h-6","M20.49 15a9 9 0 1 1-2.12-9.36L23 10"], // circular skip-forward arrow
  volume:  ["M11 5L6 9H2v6h4l5 4V5z","M15.5 8.5a5 5 0 0 1 0 7","M19 5a9 9 0 0 1 0 14"],
  link:    ["M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5","M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"],
  copy:    ["M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z","M5 15H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1"],
  refresh: ["M23 4v6h-6","M1 20v-6h6","M3.5 9a9 9 0 0 1 14.85-3.36L23 10","M1 14l4.64 4.36A9 9 0 0 0 20.5 15"],
  trash:   ["M3 6h18","M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"],
  plus:    ["M12 5v14","M5 12h14"],
  check:   "M20 6L9 17l-5-5",
  x:       ["M18 6L6 18","M6 6l12 12"],
  arrow:   ["M5 12h14","M12 5l7 7-7 7"],
  arrowLeft:["M19 12H5","M12 19l-7-7 7-7"],
  sun:     ["M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z","M12 1v2","M12 21v2","M4.22 4.22l1.42 1.42","M18.36 18.36l1.42 1.42","M1 12h2","M21 12h2","M4.22 19.78l1.42-1.42","M18.36 5.64l1.42-1.42"],
  bell:    ["M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9","M13.73 21a2 2 0 0 1-3.46 0"],
  moon:    "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  dot:     "M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0",
  lock:    ["M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z","M7 11V7a5 5 0 0 1 10 0v4"],
  logout:  ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4","M16 17l5-5-5-5","M21 12H9"],
  users:   ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2","M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z","M23 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75"],
  settings:["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z","M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"],
  share:   ["M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8","M16 6l-4-4-4 4","M12 2v13"],
  film:    ["M19.82 2H4.18A2.18 2.18 0 0 0 2 4.18v15.64A2.18 2.18 0 0 0 4.18 22h15.64A2.18 2.18 0 0 0 22 19.82V4.18A2.18 2.18 0 0 0 19.82 2z","M7 2v20","M17 2v20","M2 12h20","M2 7h5","M2 17h5","M17 17h5","M17 7h5"],
};

// ─── Media URL helpers ─────────────────────────────────────────────────────────
// Audio is hosted on Cloudflare R2 (or any host) and referenced by a direct file URL,
// so we use it as-is. (Kept tolerant of an old Google Drive share link, just in case.)
function audioDirectUrl(url) {
  if (!url) return "";
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  return url; // R2/direct URL — use as-is
}
// Guess the correct MIME type from the file extension so the browser knows how to play it.
// R2 sometimes serves .m4a as the non-standard "audio/x-m4a", which many browsers refuse;
// declaring the standard type on a <source> element makes .mp3 and .m4a both play reliably.
function audioMimeType(url) {
  if (!url) return "";
  const clean = url.split("?")[0].split("#")[0].toLowerCase();
  if (clean.endsWith(".mp3"))  return "audio/mpeg";
  if (clean.endsWith(".m4a"))  return "audio/mp4";
  if (clean.endsWith(".aac"))  return "audio/aac";
  if (clean.endsWith(".wav"))  return "audio/wav";
  if (clean.endsWith(".ogg"))  return "audio/ogg";
  if (clean.endsWith(".oga"))  return "audio/ogg";
  if (clean.endsWith(".webm")) return "audio/webm";
  if (clean.endsWith(".flac")) return "audio/flac";
  return ""; // unknown — let the browser sniff
}
// Convert any YouTube link (watch, youtu.be, shorts, or an existing embed) to an embed URL.
function youtubeEmbedUrl(url) {
  if (!url) return "";
  let id = "";
  let m;
  if ((m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/))) id = m[1];
  else if ((m = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/))) id = m[1];
  else if ((m = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/))) id = m[1];
  else if ((m = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/))) id = m[1];
  else if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) id = url.trim();
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` : "";
}
function isYouTubeUrl(url) { return !!youtubeEmbedUrl(url); }

// ─── Date formatter ─────────────────────────────────────────────────────────────
function prettyDate(d) {
  if (!d) return "";
  const date = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  if (isNaN(date)) return d;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
// Relative recency for fresh episodes ("3 days ago"); returns "" once an
// episode is over a month old (or the date is future/unparseable) so the
// card falls back to the plain date.
function timeAgo(d) {
  if (!d) return "";
  const date = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
  if (isNaN(date)) return "";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 0 || days > 31) return "";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}
// Published line on listener episode cards: recency alone while it's fresh
// ("Published 3 days ago"), plain date once it's over a month old.
const PublishedDate = ({ date, style={} }) => {
  if (!date) return null;
  const ago = timeAgo(date);
  return (
    <span style={{fontSize:12,color:T.gray,fontWeight:600,...style}}>
      Published {ago || prettyDate(date)}
    </span>
  );
};

// ─── Web Push notifications ─────────────────────────────────────────────────────
// Free device notifications instead of email/SMS: the browser subscribes via
// the service worker (public/sw.js) and the backend pushes "new episode"
// alerts to every subscribed device (netlify/functions/store.mjs `notify`).
const isIOS = () => typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  (typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches) ||
  (typeof navigator !== "undefined" && navigator.standalone === true);
// "supported" | "ios-needs-install" (iOS exposes push only from a
// Home-Screen app) | "unsupported"
function pushSupport() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
  if (!("PushManager" in window) || !("Notification" in window)) {
    return isIOS() && !isStandalone() ? "ios-needs-install" : "unsupported";
  }
  return "supported";
}
function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
async function getPushSubscription() {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch { return null; }
}
async function enablePush() {
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, reason: "denied" };
    const res = await api({ action: "vapid_public" });
    if (!res || !res.publicKey) return { ok: false, reason: "no-server" };
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(res.publicKey),
    });
    const saved = await api({ action: "push_subscribe", subscription: sub.toJSON() });
    if (!(saved && saved.ok)) { try { await sub.unsubscribe(); } catch {} return { ok: false, reason: "no-server" }; }
    return { ok: true };
  } catch { return { ok: false, reason: "error" }; }
}
async function disablePush() {
  const sub = await getPushSubscription();
  if (!sub) return;
  await api({ action: "push_unsubscribe", endpoint: sub.endpoint });
  try { await sub.unsubscribe(); } catch {}
}

// ─── Storage ───────────────────────────────────────────────────────────────────
// Shared backend: a Netlify Function (netlify/functions/store.mjs) backed by
// Netlify Blobs, so episodes, subscribers, and settings are the same for every
// family member on every device. When the API isn't reachable (e.g. plain
// `vite` dev without Netlify), falls back to the per-browser localStorage shim
// in src/storage.js so the app still works as a single-device demo.
const API_URL = "/api/store";
let apiDown = false;     // flipped after a failed reach — use localStorage fallback
let adminSecret = "";    // held in memory after a successful admin login

async function api(body) {
  if (apiDown) return null;
  let r;
  try {
    r = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(adminSecret ? { ...body, adminPw: adminSecret } : body),
    });
  } catch { apiDown = true; return null; }
  // A static host without the function serves the SPA's HTML here.
  if (r.status === 404 || r.status === 405 || !(r.headers.get("content-type") || "").includes("json")) {
    apiDown = true; return null;
  }
  try { return await r.json(); } catch { return null; }
}

const localFallback = {
  async get(key) {
    try { const r = await window.storage.get(key, false); return r ? JSON.parse(r.value) : null; }
    catch { return null; }
  },
  async set(key, val) {
    try { await window.storage.set(key, JSON.stringify(val), false); } catch {}
  },
};

const store = {
  async get(key) {
    const res = await api({ action: "get", key });
    if (res && "value" in res) return res.value;
    return localFallback.get(key);
  },
  async set(key, val) {
    const res = await api({ action: "set", key, value: val });
    if (res && res.ok) {
      // Changing the admin password invalidates the in-memory credential.
      if (key === "admin_pw" && typeof val === "string" && val) adminSecret = val;
      return;
    }
    return localFallback.set(key, val);
  },
};

// Login check — server-side when the API is up, so passwords never reach the
// browser; local comparison only in the single-device fallback mode.
async function verifyPassword(pw) {
  const res = await api({ action: "verify", password: pw });
  let role = null;
  if (res && "role" in res) {
    role = res.role;
  } else {
    const [lp, ap] = await Promise.all([localFallback.get("listener_pw"), localFallback.get("admin_pw")]);
    role = pw === (ap || DEFAULT_ADMIN_PW) ? "admin" : pw === (lp || DEFAULT_LISTENER_PW) ? "listener" : null;
  }
  if (role === "admin") adminSecret = pw;
  return role;
}

// Magic-link token check — returns { name } for a valid subscriber token.
async function matchToken(token) {
  if (!token) return null;
  const res = await api({ action: "token", token });
  if (res && "match" in res) return res.match;
  const subs = (await localFallback.get("subscribers")) || [];
  const m = subs.find((s) => s && s.token === token);
  return m ? { name: m.name } : null;
}

// The "remember me" token is per-device by design — plain localStorage.
const localGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const localSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

const DEFAULT_ADMIN_PW    = "admin123";
const DEFAULT_LISTENER_PW = "family2024";
const PLACEHOLDER_EPISODES = [
  { id:1, type:"audio", title:"Welcome to Sunday Sit Downs", date:"2025-01-05", url:"https://media.sundaysitdowns.com/welcome.mp3", notes:"Our very first episode — introductions all around." },
  { id:2, type:"video", title:"Holiday Gathering Recap",    date:"2025-01-12", url:"", notes:"Video from our holiday get-together." },
];

// ─── Primitives ──────────────────────────────────────────────────────────────────
const Toast = ({ msg, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 4000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:T.surface2,color:T.white,padding:"12px 20px",borderRadius:12,fontSize:13,fontFamily:T.font,zIndex:9999,boxShadow:"0 8px 32px rgba(0,0,0,.5)",border:`1px solid ${T.line}`,maxWidth:"90vw",textAlign:"center",letterSpacing:.2}}>{msg}</div>
  );
};

const Btn = ({ children, onClick, variant="primary", small, disabled, icon, style={} }) => {
  const v = {
    primary: { background:T.white, color:T.bg },
    subtle:  { background:T.surface2, color:T.white, border:`1px solid ${T.line}` },
    ghost:   { background:"transparent", color:T.grayDim, border:`1px solid ${T.line}` },
    danger:  { background:"transparent", color:T.accents.red, border:`1px solid ${T.accents.red}44` },
    success: { background:T.accents.green, color:"#fff" },
  };
  return (
    <button
      style={{display:"inline-flex",alignItems:"center",gap:7,fontFamily:T.font,fontWeight:600,fontSize:small?12:14,padding:small?"7px 14px":"11px 20px",borderRadius:10,cursor:disabled?"not-allowed":"pointer",border:"none",transition:"opacity .15s, transform .05s",opacity:disabled?.45:1,letterSpacing:.2,...v[variant],...style}}
      onClick={onClick} disabled={disabled}
      onMouseDown={e=>e.currentTarget.style.transform="scale(.98)"}
      onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
      onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
    >
      {icon && <Icon d={icon} size={small?14:16} stroke={2.2}/>}
      {children}
    </button>
  );
};

// On-brand back button — quiet hairline ghost that warms to sand on hover,
// matching the admin header's button language.
const BackButton = ({ onClick, label = "Back" }) => (
  <button
    onClick={onClick}
    onMouseEnter={(e) => { e.currentTarget.style.color = T.white; e.currentTarget.style.borderColor = T.accents.sand + "66"; }}
    onMouseLeave={(e) => { e.currentTarget.style.color = T.grayDim; e.currentTarget.style.borderColor = T.line; }}
    style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: `1px solid ${T.line}`, borderRadius: 9, padding: "7px 14px", color: T.grayDim, cursor: "pointer", fontSize: 13, fontFamily: T.font, fontWeight: 600, letterSpacing: .2, transition: "color .15s, border-color .15s" }}
  >
    <Icon d={Icons.arrowLeft} size={15} stroke={2.2} /> {label}
  </button>
);

// ─── Theme toggle ───────────────────────────────────────────────────────────────
// Flips the `data-theme` attribute on <html>, which swaps the CSS color
// variables instantly (no re-render). Choice persists in localStorage; the
// initial value is applied pre-paint by the inline script in index.html.
function currentTheme() {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}
const ThemeToggle = ({ style={} }) => {
  const [theme, setTheme] = useState(currentTheme());
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("ssd_theme", next); } catch {}
    setTheme(next);
  };
  const dark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      onMouseEnter={(e)=>{e.currentTarget.style.color=T.accents.sand;e.currentTarget.style.borderColor=T.accents.sand+"66";}}
      onMouseLeave={(e)=>{e.currentTarget.style.color=T.grayDim;e.currentTarget.style.borderColor="var(--line)";}}
      style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:36,height:36,background:"none",border:`1px solid ${T.line}`,borderRadius:9,color:T.grayDim,cursor:"pointer",transition:"color .15s, border-color .15s",...style}}
    >
      <Icon d={dark ? Icons.sun : Icons.moon} size={17} stroke={2}/>
    </button>
  );
};

const Field = ({ label, hint, textarea, ...props }) => (
  <div style={{marginBottom:16}}>
    {label && <label style={{display:"block",marginBottom:6,fontSize:11,color:T.grayDim,fontFamily:T.font,fontWeight:600,letterSpacing:.6,textTransform:"uppercase"}}>{label}</label>}
    {hint  && <p style={{margin:"0 0 8px",fontSize:12,color:T.gray,fontFamily:T.font}}>{hint}</p>}
    {textarea
      ? <textarea style={{width:"100%",boxSizing:"border-box",padding:"12px 14px",borderRadius:10,border:`1px solid ${T.line}`,fontFamily:T.font,fontSize:14,color:T.white,background:T.bg,minHeight:88,resize:"vertical",outline:"none"}} {...props}/>
      : <input style={{width:"100%",boxSizing:"border-box",padding:"12px 14px",borderRadius:10,border:`1px solid ${T.line}`,fontFamily:T.font,fontSize:14,color:T.white,background:T.bg,outline:"none"}} {...props}/>
    }
  </div>
);

const Panel = ({ children, style={} }) => (
  <div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:16,padding:"22px 24px",marginBottom:14,...style}}>{children}</div>
);

// Solid filled pill (calendar-style color block). Dark text on the brand color.
const Tag = ({ children, color=T.accents.marigold }) => (
  <span style={{display:"inline-flex",alignItems:"center",gap:5,background:color,color:onColorInk(color),fontSize:11,fontWeight:800,padding:"4px 11px",borderRadius:7,fontFamily:T.font,letterSpacing:.2}}>
    {children}
  </span>
);
// Soft tinted pill — used where a lighter touch reads better (e.g. status)
const SoftTag = ({ children, color=T.accents.sage }) => (
  <span style={{display:"inline-flex",alignItems:"center",gap:5,background:color+"33",color:T.white,fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:7,fontFamily:T.font,letterSpacing:.2}}>
    <span style={{width:6,height:6,borderRadius:"50%",background:color,display:"inline-block"}}/>
    {children}
  </span>
);

// ─── Audio Player ──────────────────────────────────────────────────────────────
const AudioPlayer = ({ src, accent }) => {
  const audioRef = useRef(null);
  const barRef   = useRef(null);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume,   setVolume]   = useState(1);
  const [dragging, setDragging] = useState(false);
  const [failed,   setFailed]   = useState(false);

  const fmt = (s) => (!s||isNaN(s)) ? "0:00" : `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
  const toggle = () => { const a=audioRef.current; if(!a)return; a.paused?a.play().catch(()=>{}):a.pause(); };
  const seek = useCallback((e) => {
    if(!barRef.current||!audioRef.current||!duration)return;
    const rect=barRef.current.getBoundingClientRect();
    const pct=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
    audioRef.current.currentTime=pct*duration; setProgress(pct*duration);
  },[duration]);
  const skip = (s) => { const a=audioRef.current; if(!a)return; a.currentTime=Math.max(0,Math.min(duration,a.currentTime+s)); };

  useEffect(() => {
    const a=audioRef.current; if(!a)return;
    const onTime=()=>setProgress(a.currentTime), onMeta=()=>setDuration(a.duration),
          onEnd=()=>setPlaying(false), onPlay=()=>setPlaying(true), onPause=()=>setPlaying(false), onErr=()=>setFailed(true);
    a.addEventListener("timeupdate",onTime); a.addEventListener("loadedmetadata",onMeta);
    a.addEventListener("ended",onEnd); a.addEventListener("play",onPlay); a.addEventListener("pause",onPause); a.addEventListener("error",onErr);
    return () => { a.removeEventListener("timeupdate",onTime); a.removeEventListener("loadedmetadata",onMeta); a.removeEventListener("ended",onEnd); a.removeEventListener("play",onPlay); a.removeEventListener("pause",onPause); a.removeEventListener("error",onErr); };
  }, []);

  const pct = duration ? (progress/duration)*100 : 0;
  if (!src) return <div style={{padding:"14px 0",fontSize:13,color:T.gray,fontFamily:T.font}}>No audio file linked yet.</div>;

  const audioSrc = audioDirectUrl(src);
  const mime = audioMimeType(audioSrc);

  return (
    <div style={{marginTop:18}}>
      {/* A <source> with an explicit type makes browsers play .m4a even when the host
          mislabels it (R2 serves .m4a as non-standard audio/x-m4a). Falls back to a bare
          src when the extension is unknown so the browser can sniff the type itself. */}
      <audio ref={audioRef} key={audioSrc} src={mime ? undefined : audioSrc} preload="metadata">
        {mime && <source src={audioSrc} type={mime}/>}
      </audio>
      {failed && (
        <div style={{padding:"12px 14px",borderRadius:10,background:T.bg,border:`1px solid ${T.line}`,marginBottom:14}}>
          <p style={{margin:"0 0 6px",fontSize:13,color:T.white,fontFamily:T.font,fontWeight:600}}>This file couldn't stream in the browser.</p>
          <a href={src} target="_blank" rel="noreferrer" style={{fontSize:13,color:accent,fontFamily:T.font,fontWeight:700}}>Open file directly →</a>
        </div>
      )}
      {/* progress */}
      <div ref={barRef} onClick={seek} onMouseDown={()=>setDragging(true)} onMouseMove={e=>{if(dragging)seek(e);}} onMouseUp={()=>setDragging(false)}
        style={{height:4,background:T.line,borderRadius:2,cursor:"pointer",position:"relative",marginBottom:10}}>
        <div style={{height:"100%",width:`${pct}%`,background:accent,borderRadius:2}}/>
        <div style={{position:"absolute",top:"50%",left:`${pct}%`,transform:"translate(-50%,-50%)",width:12,height:12,borderRadius:"50%",background:accent}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:T.gray,fontFamily:T.font,marginBottom:16}}>
        <span>{fmt(progress)}</span><span>{fmt(duration)}</span>
      </div>
      {/* controls */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:24}}>
        <button onClick={()=>skip(-15)} title="Back 15 seconds" style={{position:"relative",background:"none",border:"none",cursor:"pointer",color:T.grayDim,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Icon d={Icons.back15} size={26} stroke={2}/>
          <span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,fontFamily:T.font,letterSpacing:-.3,paddingTop:2}}>15</span>
        </button>
        <button onClick={toggle} style={{width:54,height:54,borderRadius:"50%",background:accent,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:onColorInk(accent),flexShrink:0}}>
          <Icon d={playing?Icons.pause:Icons.play} size={22} fill={onColorInk(accent)} color={onColorInk(accent)} stroke={0}/>
        </button>
        <button onClick={()=>skip(15)} title="Forward 15 seconds" style={{position:"relative",background:"none",border:"none",cursor:"pointer",color:T.grayDim,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Icon d={Icons.fwd15} size={26} stroke={2}/>
          <span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,fontFamily:T.font,letterSpacing:-.3,paddingTop:2}}>15</span>
        </button>
      </div>
      {/* volume */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginTop:18,justifyContent:"center"}}>
        <Icon d={Icons.volume} size={15} color={T.gray} stroke={2}/>
        <input type="range" min={0} max={1} step={0.05} value={volume}
          onChange={e=>{const v=parseFloat(e.target.value);setVolume(v);if(audioRef.current)audioRef.current.volume=v;}}
          style={{width:100,accentColor:accent,cursor:"pointer"}}/>
      </div>
    </div>
  );
};

// ─── Video Player — embeds a private/unlisted YouTube link ─────────────────────
const VideoPlayer = ({ src, accent }) => {
  const [failed, setFailed] = useState(false);
  if (!src) return <div style={{padding:"14px 0",fontSize:13,color:T.gray,fontFamily:T.font}}>No video linked yet.</div>;

  const embed = youtubeEmbedUrl(src);
  if (embed) {
    return (
      <div style={{marginTop:18}}>
        <div style={{position:"relative",width:"100%",paddingTop:"56.25%",borderRadius:12,overflow:"hidden",background:"#000"}}>
          <iframe
            src={embed}
            title="Episode video"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            frameBorder="0"
            style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}}
          />
        </div>
      </div>
    );
  }

  // Fallback: a direct video file URL (e.g. hosted on R2) if ever used instead of YouTube.
  return (
    <div style={{marginTop:18}}>
      {failed && (
        <div style={{padding:"12px 14px",borderRadius:10,background:T.bg,border:`1px solid ${T.line}`,marginBottom:12}}>
          <p style={{margin:"0 0 6px",fontSize:13,color:T.white,fontFamily:T.font,fontWeight:600}}>This video couldn't stream in the browser.</p>
          <a href={src} target="_blank" rel="noreferrer" style={{fontSize:13,color:accent,fontFamily:T.font,fontWeight:700}}>Open video directly →</a>
        </div>
      )}
      <div style={{borderRadius:12,overflow:"hidden",background:"#000"}}>
        <video src={src} controls controlsList="nodownload" onError={()=>setFailed(true)} style={{width:"100%",display:"block",maxHeight:560}} preload="metadata"/>
      </div>
    </div>
  );
};

// ─── Brand Mark — interlocking SS monogram (real logo, scalable vector) ─────────
// SS logomark (2026 brand art). Dark-ink PNG recolored per theme by
// --logo-filter: Lynx White in dark mode, Deep Slate Olive in light.
const SSMonogram = ({ size=28, style={} }) => (
  <img src="/brand/logomark.png" alt="Sunday Sit Downs" width={size} height={size*1.012}
       style={{display:"block",filter:"var(--logo-filter)",...style}}/>
);
// App-icon lockup: monogram on the brand's dark green-black tile (never paired with the wordmark image)
const BrandMark = ({ size=40 }) => (
  <div style={{width:size,height:size,borderRadius:size*0.28,background:T.surface2,border:`1px solid ${T.line}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
    <SSMonogram size={size*0.56}/>
  </div>
);

// ─── Wordmark — "Sunday Sit Downs" lockup (stands alone; never beside the SS app icon) ──
const Wordmark = ({ width=260, style={} }) => (
  <img src="/brand/wordmark.png" alt="Sunday Sit Downs"
       style={{width,height:"auto",display:"block",filter:"var(--logo-filter)",...style}}/>
);
// Script lockup — "Sunday Sit Downs / with the Slape's" (stands alone, hero use)
// Hand-drawn "with the Slape&apos;s" script (traced from the 2026 brand art).
// fill=currentColor so it follows the theme text color like real type.
const ScriptHand = ({ style={} }) => (
  <svg viewBox="0 0 1100 217" fill="currentColor" role="img" aria-label="with the Slape&apos;s" style={{display:"block",height:"auto",...style}}>
    <path fillRule="evenodd" d="M 737.4 11.7 C 735.8 12.3, 733.7 12.9, 732.7 13.0 C 728.3 13.1, 717.5 24.3, 713.3 33 C 707.1 46.3, 707.8 62.6, 715.1 75 C 717.4 78.8, 722 89.2, 722 90.5 C 722 91.2, 722.5 92.2, 723.1 92.5 C 724.4 93.4, 731 107.2, 731 109.1 C 731 109.9, 731.7 111.6, 732.6 112.9 C 735.1 116.4, 733.9 124.4, 729.9 131.1 C 725.9 137.8, 722.0 142.6, 720.8 142.3 C 720.4 142.1, 720 142.4, 720 142.9 C 720 146.2, 706.0 146.9, 699.9 143.9 C 697.9 142.9, 696.0 142.3, 695.7 142.6 C 693.4 145.0, 681.2 127.1, 680.3 120.1 C 679.3 111.6, 689.4 95, 695.7 95 C 698.2 95, 702.0 91.0, 702.0 88.4 C 702.0 84.1, 700.8 82, 698.4 82 C 697.2 82, 695.9 81.6, 695.5 81.1 C 695.0 80.2, 694.1 80.2, 686.4 81.5 C 684.7 81.8, 682.0 83.4, 680.4 85.0 C 678.8 86.6, 677.0 88.0, 676.5 88.0 C 675.9 88.0, 674.6 89.2, 673.5 90.7 C 672.4 92.2, 670.8 94.1, 669.9 95.0 C 665.3 99.8, 660.9 117.3, 662.4 125.1 C 662.7 127.0, 662.9 128.7, 662.9 129 C 662.5 130.1, 670.1 142.6, 672.9 145.5 C 674.7 147.3, 676.9 149, 677.5 149 C 677.9 149, 679.6 150.1, 681.3 151.4 C 685.9 154.8, 692.0 157.7, 696.0 158.4 C 710.0 160.8, 714.2 161.2, 719.2 160.6 C 724.1 160.1, 729.6 157.8, 734.5 154.3 C 736.9 152.6, 745.5 140.2, 747.6 135.5 C 752.8 124.1, 752.9 111.8, 747.8 101.8 C 746.8 99.7, 746 97.5, 746 96.8 C 746 96.1, 745.1 94.9, 744 94.2 C 742.9 93.5, 742 92.4, 742 91.6 C 742 90.8, 740.4 87.4, 738.5 84 C 736.6 80.6, 735 77.0, 735 76.1 C 735 75.2, 734.6 74.0, 734.1 73.5 C 733.6 72.9, 731.6 68.7, 729.7 64.0 L 726.1 55.5 727.5 47.7 C 729.2 38.1, 731.7 34, 738.2 30.0 C 750.4 22.5, 758.2 29.3, 757.1 46.4 C 756.4 55.7, 757.6 59.7, 760.6 58.6 C 761.4 58.3, 762.3 58.7, 762.6 59.5 C 763.4 61.5, 766 61.4, 766 59.4 C 766 58.2, 766.7 57.9, 768.5 58.2 C 775.0 59.5, 777.0 34.6, 771 27.0 C 765.1 19.5, 763.7 18, 762.3 18 C 761.6 18, 761.0 17.7, 761.0 17.3 C 761.0 14.4, 741.7 9.8, 737.4 11.7 M 813.8 26.7 C 812.9 27.7, 810.3 32.5, 808.0 37.5 C 804.0 46.3, 798.4 57.5, 782.8 88.3 C 778.5 96.6, 775 104.1, 775 104.8 C 775 105.4, 774.5 106, 774 106 C 773.5 106, 773 106.9, 773 108.0 C 773 109.0, 772.6 110.9, 772.1 112.2 C 765.9 128.7, 768.8 148.3, 778.4 153.3 C 790.2 159.6, 798.7 158.0, 808.5 147.5 L 812.0 143.9 815.9 147.7 C 820.5 152.2, 836 157.8, 836 154.9 C 836 154.5, 837.5 153.8, 839.4 153.4 C 841.7 153.0, 844.6 151.1, 848.1 147.5 L 853.4 142.2 859.2 145.1 C 865.1 148.1, 869.4 148.8, 870.5 147 C 870.8 146.4, 871.9 146, 872.9 146 C 873.9 146, 875.3 145.3, 876.0 144.5 C 876.7 143.7, 877.6 143.3, 878.1 143.6 C 878.6 143.9, 879 143.6, 879 142.9 C 879 142.2, 879.3 141.9, 879.6 142.3 C 879.9 142.6, 879.3 146.2, 878.1 150.2 C 872.0 171.1, 870.4 177.5, 869.1 186.7 C 867.1 200.1, 868.6 203, 877.7 203 C 883.4 203, 884.6 201.0, 887.6 186.9 C 889.0 180.1, 890.5 174.1, 890.8 173.5 C 891.2 172.9, 891.5 171.9, 891.7 171.1 C 892.0 168.5, 897.1 152.6, 898.6 149.2 C 899.9 146.0, 900.1 146.0, 902.7 147.4 C 915.2 153.8, 939.2 134.2, 949.0 109.5 C 950.3 106.2, 952.0 102.5, 952.8 101.2 C 955.0 97.8, 957.1 86.4, 956.1 83.8 C 955.6 82.5, 954.6 79.3, 953.9 76.5 C 950.8 63.9, 939.5 57.0, 929.5 61.6 C 924.1 64.1, 923.8 64.1, 922.5 62.4 C 921.7 61.3, 921.0 60.9, 921.0 61.3 C 921.0 61.8, 920 61.4, 918.8 60.6 C 914.9 57.9, 908.0 61.0, 906.5 66.2 C 906.1 67.5, 904.8 70.8, 903.5 73.5 C 902.2 76.3, 899.3 82.5, 897.1 87.4 C 894.8 92.3, 891.8 97.9, 890.3 99.8 C 888.9 101.7, 886.7 105.1, 885.6 107.4 C 882.3 114.0, 870.3 128, 868.0 128 C 866.4 128, 869.1 115.3, 872.0 108.5 C 872.5 107.4, 873.8 104.5, 874.8 102 C 875.9 99.5, 878.2 94.5, 879.8 90.8 C 881.5 87.0, 882.7 84, 882.5 84 C 882.3 84, 882.5 82.6, 883.0 81.0 C 883.6 78.9, 883.5 77.7, 882.7 77.0 C 869.2 65.9, 859.7 61.1, 858.3 64.6 C 858.0 65.3, 857.3 66, 856.6 66 C 853.7 66, 833.9 85.3, 825.3 96.6 C 819.4 104.4, 811 117.5, 811 118.9 C 811 119.4, 808.9 122.0, 806.3 124.7 C 803.6 127.5, 799.3 132.3, 796.5 135.3 C 791.7 140.6, 788.2 142.5, 787.9 139.8 C 787.8 139.1, 787.6 137.4, 787.4 136 C 785.7 124.9, 791.7 104.2, 800.2 91.8 C 801.2 90.4, 802 88.9, 802 88.6 C 802 88.3, 804.3 83.8, 807.2 78.8 C 815.8 63.3, 824.3 45.4, 825.5 40 C 825.7 39.2, 826.3 37.1, 826.9 35.3 C 827.7 32.5, 827.6 32.1, 825.5 31.6 C 824.2 31.3, 822.9 30.1, 822.5 29.1 C 822.2 28.1, 821.2 27.0, 820.2 26.7 C 819.3 26.4, 817.8 25.9, 816.9 25.6 C 816.0 25.2, 814.7 25.7, 813.8 26.7 M 447.5 31.0 C 442.7 32.9, 440.8 36.0, 427.6 64.2 C 424.1 71.7, 422.6 74.0, 420.8 74.4 C 417.6 75.1, 409.0 76.4, 406 76.6 C 404.6 76.8, 400.4 77.5, 396.5 78.3 C 392.7 79.1, 389.0 79.5, 388.3 79.3 C 387.6 79, 386.4 79.2, 385.7 79.7 C 385.1 80.3, 381.0 81.7, 376.8 83.0 C 366.0 86.3, 361.3 92.4, 368.1 94.5 C 369.1 94.9, 370 95.5, 370 96.0 C 370 98.4, 380.7 97.5, 407.4 92.9 C 416.3 91.3, 416.4 92.0, 409.0 106.2 C 399.1 125.3, 392.5 135.1, 384.0 143 C 379.3 147.4, 376.7 152, 379.0 152 C 379.6 152, 379.8 152.4, 379.5 153 C 379.2 153.6, 379.5 154, 380.3 154 C 381.1 154, 382.5 154.9, 383.5 156.1 C 387.8 160.8, 398.6 154.6, 407.4 142.6 C 408.7 140.7, 408.8 140.7, 410.3 143.6 C 413.3 149.3, 425.4 156.2, 432.6 156.2 C 436.1 156.2, 445.2 151.3, 450.5 146.5 C 455.8 141.8, 457.4 141.2, 458.7 143.4 C 460.1 146.0, 467.0 150, 470 150 C 472.6 150, 481 138.9, 481 135.5 C 481 134.2, 490.2 121.6, 495.4 115.9 C 500.5 110.2, 504.4 108.5, 502.0 113.0 C 501.5 114.0, 501 116.9, 501 119.4 C 501 121.9, 500.6 124.1, 500.1 124.5 C 499.5 124.8, 499.1 125.8, 499.0 126.8 C 497.8 147.1, 498.2 148.6, 508.3 155.1 C 514.1 158.9, 523 160.7, 523 158.1 C 523 157.6, 524.3 156.9, 525.9 156.5 C 527.5 156.2, 529.4 155.2, 530.1 154.4 C 530.7 153.6, 531.8 153, 532.5 153 C 533.2 153, 534.0 152.4, 534.3 151.7 C 534.5 151.0, 537.5 148.8, 540.9 146.8 L 546.9 143.2 549.7 145.7 C 561.3 155.9, 578.4 160.9, 586.9 156.6 C 588.3 155.9, 593.0 154.5, 597.3 153.5 C 601.5 152.5, 605 151.3, 605 150.8 C 605 150.3, 605.4 150.1, 605.8 150.4 C 607.4 151.4, 614.8 145.0, 615.9 141.8 C 618.1 135.6, 606.0 127.9, 602 132.9 C 601.4 133.7, 588.4 138.2, 585.5 138.6 C 584.4 138.8, 581.2 139.5, 578.4 140.3 C 571.6 142.2, 560.4 139.1, 559.9 135.2 C 559.9 134.8, 559.7 133.5, 559.6 132.2 C 559.1 127.7, 561.1 126.6, 565.3 129.0 C 578.3 136.7, 597.5 124.4, 601.4 105.9 C 602.5 100.7, 602.5 99.2, 601.4 98 C 600.7 97.2, 599.8 95.2, 599.5 93.7 C 599.0 92.0, 597.8 90.5, 596.4 90.0 C 595.1 89.5, 594 88.6, 594 88.0 C 594 87.5, 593.4 87, 592.6 87 C 591.9 87, 590.7 86.3, 590.0 85.4 C 583.4 77.6, 562.3 82.7, 557.9 93.2 C 557.3 94.7, 556.5 96, 556.1 96 C 555.7 96, 554.6 97.6, 553.6 99.5 C 552.5 101.4, 551.3 103, 550.8 103 C 550.4 103, 550 103.7, 550 104.5 C 550 105.3, 549.5 106, 549 106 C 548.5 106, 548 106.8, 548 107.8 C 548 108.8, 547.6 110.0, 547.1 110.5 C 546.7 111.1, 545.5 113.8, 544.5 116.5 C 542.3 122.5, 539.3 125.9, 532.3 130.6 C 529.4 132.5, 527 134.6, 527 135.1 C 527 135.7, 525.6 136.6, 524 137.2 C 522.4 137.7, 521 138.6, 521 139.0 C 521 140.2, 518.5 140.9, 517.1 140.1 C 516.2 139.5, 516.3 137.6, 517.6 131.9 C 518.5 127.8, 519.4 122.9, 519.6 121 C 519.9 119.1, 520.5 114.8, 521.1 111.4 C 522.1 105.5, 522.1 101.1, 521.0 100 C 520.7 99.7, 519.7 98.3, 518.7 96.8 C 514.3 89.8, 501.3 85.4, 498.5 90.1 C 498.1 90.6, 497.4 91, 496.9 91 C 494.8 91, 497.7 81.5, 504.5 66 C 510.7 52.0, 510.8 51.3, 506.3 46.6 C 500.8 40.9, 498.8 40.5, 494.9 44.1 C 491.5 47.3, 486 57.0, 486 59.9 C 486 60.8, 485.5 62.1, 484.9 62.7 C 483.7 63.9, 480 63.3, 480 61.8 C 480 58.5, 471.8 58.0, 464 60.8 C 463.2 61.1, 462.2 61.4, 461.8 61.4 C 461.5 61.5, 460.8 61.8, 460.4 62.3 C 460.0 62.7, 458.6 63, 457.4 63 C 456.1 63, 454.8 63.5, 454.5 64 C 453.8 65.2, 450 65.4, 450 64.2 C 450 63.1, 454.8 50.1, 456.5 46.7 C 458.7 42.2, 458.4 38.7, 455.3 35.4 C 451.1 30.9, 449.7 30.1, 447.5 31.0 M 1053 34.1 C 1040.0 39.3, 1036.3 57.0, 1048.2 57.3 C 1052.4 57.4, 1066 45.2, 1066 41.4 C 1066 39.1, 1063.6 36, 1061.9 36 C 1061.3 36, 1061.1 35.6, 1061.4 35.1 C 1062.7 33.1, 1057.2 32.5, 1053 34.1 M 223.2 48.0 C 221.0 49.7, 218.8 52.0, 218.5 53.0 C 217.5 56.0, 206.1 74.6, 204.1 76.4 C 203.1 77.3, 201.0 78.3, 199.4 78.5 C 194.3 79.3, 190.5 80.1, 189 80.8 C 188.2 81.1, 186.8 81.4, 185.9 81.5 C 181.5 82.0, 178.9 83.3, 177.1 85.9 L 175.1 88.7 177.1 90.9 C 178.2 92.0, 179.5 93, 180.0 93 C 180.5 93, 181.6 93.8, 182.6 94.7 C 183.5 95.6, 185.7 96.4, 187.6 96.4 C 191.5 96.4, 191.9 95.4, 181.3 111.2 C 161.9 140.1, 139.6 155.4, 151.7 131.5 C 155.9 123.4, 157.9 119.7, 159.3 118.1 C 163.4 113.3, 161.5 104.6, 156.1 103.9 C 150.2 103.1, 149.2 103.8, 142.8 113 C 137.6 120.5, 130 135.9, 130 139.1 C 130 148.4, 150.3 162.6, 157.4 158.3 C 158.0 157.9, 159.2 157.5, 160.2 157.5 C 163.4 157.2, 176.8 146.1, 183.0 138.6 C 188.2 132.1, 192.2 129.4, 190.7 133.4 C 190.0 135.2, 194.3 143.7, 197.2 145.9 C 207.7 154.2, 214.9 154.8, 227.5 148.5 C 238.0 143.2, 237 143.5, 237 145.9 C 237 148.5, 244.1 154.0, 248.3 154.7 C 251.9 155.3, 254.3 152.9, 263.9 138.7 C 265.6 136.1, 268.2 132.8, 269.6 131.3 C 271.0 129.8, 272.5 128.1, 272.8 127.5 C 273.9 125.9, 285.1 117, 286.1 117 C 287.3 117, 287.2 118.7, 285.9 119.5 C 285.4 119.9, 285.1 120.7, 285.3 121.3 C 285.5 122.0, 284.7 124.1, 283.5 126 C 277.5 135.8, 274.0 147.3, 275.5 152.7 C 276.0 154.2, 276.4 156.0, 276.6 156.6 C 277.2 159.9, 290.3 169, 294.3 169 C 297.5 169, 311.1 163.9, 313.6 161.8 C 325.2 152.1, 327.4 148.1, 323.6 143.8 C 318.9 138.3, 315.9 138.2, 310.3 143.3 C 307.8 145.6, 296.1 152, 294.4 152 C 292.5 152, 298.3 134.8, 303.9 124.1 C 310.6 111.3, 309.9 105.1, 301.2 100.0 C 295.6 96.7, 283.1 97.4, 278.2 101.3 C 273.7 104.9, 276.4 98.5, 291.4 70.3 C 296.7 60.4, 297.8 57.6, 297.1 55.8 C 295.9 52.8, 290.1 46, 288.7 46 C 285.7 46, 279.7 51.7, 277.2 56.9 C 271.8 68.3, 270.7 69.5, 263.7 70.9 C 260.3 71.6, 257.1 72.5, 256.5 73.0 C 255.9 73.4, 254.4 73.7, 253 73.6 C 251.6 73.5, 250.0 73.7, 249.4 74.2 C 248.9 74.6, 244.3 75.1, 239.2 75.4 C 228.7 76.0, 227.8 75.1, 232.1 68.1 C 233.2 66.3, 235.0 62.6, 236.0 60.1 L 237.8 55.5 235.4 52 C 233.1 48.8, 229.2 45.1, 227.9 45.0 C 227.6 45.0, 225.5 46.4, 223.2 48.0 M 133.4 58.1 C 121.4 67.1, 115.1 77.1, 105.1 102.5 C 95.2 127.7, 84.5 144.8, 79.3 143.8 C 74.2 142.8, 78.8 123.1, 87.1 110.9 C 92.2 103.3, 93.8 97.3, 91.3 95.4 C 87.0 92.0, 77.0 89.5, 77.0 91.8 C 77.0 92.2, 75.7 93.8, 74.2 95.5 C 72.7 97.2, 69.5 102.1, 67.2 106.4 C 64.8 110.8, 61.6 116.0, 60.0 118.1 C 58.3 120.1, 57 122.2, 57 122.7 C 57 123.2, 55.8 124.9, 54.3 126.3 C 49.1 131.2, 48 132.7, 48 134.3 C 48 135.3, 47.3 136, 46.5 136 C 45.7 136, 45 136.6, 45 137.4 C 45 139.2, 36.8 146, 34.7 146 C 22.0 146, 43.9 97.7, 66.7 75.4 C 74.1 68.2, 78.1 62, 75.2 62 C 74.8 62, 73.7 60.7, 72.7 59.1 C 68.0 51.0, 54.9 58.7, 41.5 77.4 C 40.4 79.0, 38.9 80.8, 38.2 81.6 C 37.5 82.3, 34.8 86.4, 32.2 90.7 C 27.8 97.9, 26.4 100.4, 21.6 111.2 C 20.7 113.2, 19.5 115.2, 19.0 115.5 C 18.4 115.8, 18 117.0, 18 118.0 C 18 119.0, 16.7 122.7, 15.1 126.3 C 6.8 144.7, 18.0 162, 38.3 162 C 43.1 162, 47.8 159.9, 51.5 156.0 C 53.1 154.3, 54.9 153, 55.4 153 C 56.0 153, 57.1 152.1, 57.8 150.9 L 59.2 148.8 61.8 151.3 C 68.6 157.7, 82.5 161.4, 89.1 158.6 C 100.6 153.7, 115.7 128.7, 127.4 94.8 C 129.8 88.1, 137.7 76.5, 142.8 72.5 C 150.6 66.2, 151.9 63.0, 148.4 59.0 C 142.5 52.4, 141.0 52.3, 133.4 58.1 M 1062.7 62.8 C 1062.0 64.3, 1060.9 66.4, 1060.3 67.5 C 1059.7 68.6, 1058.0 72.1, 1056.6 75.2 C 1054.0 80.6, 1050.0 86.8, 1043.5 95.0 C 1041.8 97.1, 1039.6 100.0, 1038.5 101.6 C 1036.1 105.0, 1029.6 112.6, 1026.4 115.9 C 1025.1 117.2, 1024 118.7, 1024 119.2 C 1024 119.6, 1022.8 120.6, 1021.3 121.3 C 1019.7 121.9, 1018.0 123.2, 1017.3 124.0 C 1016.6 124.8, 1016.0 125.1, 1016.0 124.7 C 1016.0 124.2, 1014.2 125.2, 1012.1 127.0 C 1006.5 131.3, 988.0 137.3, 982.3 136.5 C 967.3 134.4, 965.8 121.5, 980.6 121.9 C 985.0 122.0, 989.7 121.7, 991.1 121.1 C 992.4 120.6, 994.6 119.9, 996 119.6 C 1003.5 118.0, 1017.4 99.1, 1019.6 87.5 C 1022.4 72.5, 1002.3 60.5, 988.7 68.9 C 985.6 70.8, 974.5 81.6, 971.5 85.5 C 970.7 86.6, 968.5 89.6, 966.7 92.1 C 959.1 102.2, 950.4 124.0, 952.8 126.5 C 953.1 126.8, 953.5 127.7, 953.6 128.5 C 953.7 129.3, 954.8 131.3, 955.9 132.9 C 957.1 134.5, 958 136.2, 958 136.8 C 958 138.9, 966.6 145.4, 973.5 148.6 C 984.3 153.6, 999.5 152.6, 1013.2 146.2 C 1016.9 144.4, 1020.6 143, 1021.5 143 C 1022.3 143, 1023 142.6, 1023 142 C 1023 141.4, 1023.5 141, 1024.1 141 C 1025.4 141, 1033.5 134.6, 1037 130.9 C 1043.5 123.9, 1051.7 114.3, 1054.2 110.8 C 1057.7 106.0, 1057.6 106.0, 1063.7 112.3 C 1070.3 119.0, 1071.9 122.3, 1071.5 128.4 C 1070.9 138.2, 1064.7 140.3, 1047.5 136.6 C 1038.2 134.6, 1038.8 134.5, 1035.2 138.9 L 1032.0 142.9 1034.4 145.5 C 1043.6 155.4, 1063.9 160.7, 1074.1 155.8 C 1084.4 150.8, 1093.9 127.5, 1088 121.6 C 1087.5 121.0, 1087 119.6, 1087 118.4 C 1087 117.2, 1086.3 115.7, 1085.5 115 C 1084.7 114.3, 1084 113.4, 1084 113.0 C 1084 112.6, 1082.7 110.8, 1081.1 109.1 C 1072.8 100.2, 1071.7 93.5, 1075.9 78.1 L 1078.8 67.8 1076.1 65.0 C 1071.4 60.1, 1064.7 59.0, 1062.7 62.8 M 156.8 72.9 L 153.2 76.8 157.5 81.4 C 162.1 86.4, 166.0 87.1, 169.5 83.6 C 170.4 82.7, 171.5 82, 172.0 82 C 176.6 82, 171.8 73.6, 165.5 70.5 C 161.1 68.5, 161.0 68.5, 156.8 72.9 M 474.0 75.9 C 473.2 76.5, 472.3 76.7, 471.9 76.4 C 471.5 76.2, 470.9 76.4, 470.5 76.9 C 470.2 77.5, 469.3 77.7, 468.6 77.4 C 467.9 77.1, 466.7 77.6, 466.0 78.5 C 465.3 79.3, 464.1 80, 463.3 80 C 456.8 80, 440.2 87.3, 438.9 90.7 C 437.1 95.3, 432.4 108.2, 430.5 113.5 C 429.5 116.3, 428.3 119.4, 427.7 120.5 C 426.0 123.9, 425.6 136.2, 427.2 138.3 C 431.5 144.0, 461.1 112.9, 469.3 94.2 C 469.9 92.7, 471.7 89.4, 473.2 86.9 C 479.4 76.6, 479.7 72.4, 474.0 75.9 M 931.7 83.8 C 925.9 91.8, 907 126.5, 907 129.2 C 907 133.8, 923.7 120.2, 927.7 112.4 C 938.5 91.4, 941.4 70.4, 931.7 83.8 M 997.5 84.6 C 987.7 89.7, 976.7 106.1, 984.2 104.4 C 990.7 103.0, 994.2 99.8, 998.9 90.7 C 1003.3 82.6, 1003.0 81.7, 997.5 84.6 M 852.8 92.3 C 851.2 94.1, 847.6 98.0, 844.8 101.1 C 833.4 113.1, 826.9 125.1, 827.6 132.4 C 828.4 140.4, 832.7 139.3, 839.5 129.6 C 840.6 128.1, 842.1 126.2, 842.7 125.5 C 845.2 122.9, 849.9 113.4, 851.5 107.5 C 852.4 104.2, 854.1 98.8, 855.1 95.6 C 857.7 87.5, 857.3 87.0, 852.8 92.3 M 256.8 90.6 C 256.5 90.9, 250.6 91.3, 243.8 91.6 C 224.5 92.3, 221.4 92.8, 220.2 95.3 C 212.2 112.2, 206.5 132.9, 209.1 135.5 C 213.1 139.6, 236.2 123.7, 246.8 109.6 C 254.8 99.0, 261.9 85.4, 256.8 90.6 M 577.5 97.9 C 566.9 104.5, 564.5 115.9, 574.3 113.2 C 578.1 112.1, 582.9 107.6, 583.0 105.0 C 583.0 104.1, 583.4 103.0, 584.0 102.4 C 585.0 101.4, 583.2 96.9, 581.5 96.3 C 581.0 96.2, 579.1 96.8, 577.5 97.9"/>
  </svg>
);

// Responsive HTML/CSS lockup (2026 type spec): Inter Medium 72px at -5%
// tracking over two lines; the script line is the hand-drawn SVG above,
// sized to match the headline width. Real text + vector — scales fluidly
// and follows the theme color with no image or filter.
const ScriptTitle = ({ style={} }) => (
  <div style={{display:"inline-block",color:T.white,userSelect:"none",...style}}>
    <h1 style={{margin:0,fontFamily:T.font,fontWeight:500,fontSize:"clamp(44px, 9vw, 72px)",letterSpacing:"-0.05em",lineHeight:1.02}}>
      Sunday<br/>Sit Downs
    </h1>
    <ScriptHand style={{width:"96%",marginTop:14}}/>
  </div>
);

// ─── Lock Screen ───────────────────────────────────────────────────────────────
const LockScreen = ({ onSubmit, onBack, isAdmin, onSimulateMagicLink }) => {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!pw || busy) return;
    setBusy(true);
    const ok = await onSubmit(pw);
    setBusy(false);
    if (!ok) { setErr(true); setPw(""); }
  };
  return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,fontFamily:T.font}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28}}>
          {onBack ? <BackButton onClick={onBack}/> : <span/>}
          <ThemeToggle/>
        </div>
        <div style={{marginBottom:36}}>
          <SSMonogram size={44}/>
        </div>
        <h1 style={{fontFamily:T.serif,fontSize:52,fontWeight:600,color:T.white,margin:"0 0 6px",lineHeight:1,letterSpacing:-1}}>
          {isAdmin ? "Admin." : "Welcome."}
        </h1>
        <p style={{fontSize:14,color:T.grayDim,margin:"0 0 36px"}}>
          {isAdmin ? "Enter your admin password." : "Enter the family password to listen."}
        </p>
        <input type="password" value={pw} autoFocus placeholder="Password"
          onChange={e=>{setPw(e.target.value);setErr(false)}} onKeyDown={e=>e.key==="Enter"&&submit()}
          style={{width:"100%",boxSizing:"border-box",padding:"14px 16px",borderRadius:12,border:`1px solid ${err?T.accents.red:T.line}`,fontFamily:T.font,fontSize:16,color:T.white,background:T.surface,outline:"none",marginBottom:err?8:16}}/>
        {err && <p style={{fontSize:13,color:T.accents.red,margin:"0 0 12px"}}>Incorrect password, try again.</p>}
        <Btn onClick={submit} disabled={busy} icon={Icons.arrow} style={{width:"100%",justifyContent:"center"}}>{busy ? "Checking…" : "Enter"}</Btn>
        {!isAdmin && onSimulateMagicLink && (
          <div style={{marginTop:32,paddingTop:24,borderTop:`1px solid ${T.line}`}}>
            <p style={{fontSize:12,color:T.gray,margin:"0 0 12px",lineHeight:1.6}}>
              <span style={{color:T.grayDim,fontWeight:600}}>Preview note:</span> Family members won't normally see this — their private link logs them in automatically. Tap to simulate that.
            </p>
            <Btn variant="ghost" icon={Icons.link} onClick={onSimulateMagicLink} style={{width:"100%",justifyContent:"center"}}>Simulate magic-link arrival</Btn>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Subscribe Page ────────────────────────────────────────────────────────────
const SubscribePage = ({ onBack }) => {
  const [form, setForm] = useState({ name:"", email:"", message:"" });
  const [sent, setSent] = useState(false);
  const [toast, setToast] = useState(null);
  const submit = async () => {
    if(!form.name||!form.email){setToast("Please fill in your name and how to reach you.");return;}
    // Shared backend appends the request server-side; fall back to the
    // per-browser store when the API isn't available (local demo mode).
    const res = await api({ action:"request", name:form.name, email:form.email, message:form.message });
    if (!(res && res.ok)) {
      const reqs=(await store.get("subscribe_requests"))||[];
      reqs.push({...form,id:Date.now(),status:"pending",requestedAt:new Date().toISOString()});
      await store.set("subscribe_requests",reqs);
    }
    setSent(true);
  };
  if (sent) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:32,fontFamily:T.font}}>
      <div style={{maxWidth:400,width:"100%"}}>
        <div style={{width:48,height:48,borderRadius:"50%",background:T.accents.sage+"33",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20}}>
          <Icon d={Icons.check} size={24} color={T.white} stroke={2.5}/>
        </div>
        <h1 style={{fontFamily:T.serif,fontSize:44,fontWeight:600,color:T.white,margin:"0 0 10px",letterSpacing:-.5}}>Request sent.</h1>
        <p style={{color:T.grayDim,fontSize:15,margin:"0 0 28px"}}>The Slapes will review your request and reach out when you're approved.</p>
        <BackButton onClick={onBack} label="Back home"/>
      </div>
    </div>
  );
  return (
    <div style={{minHeight:"100vh",background:T.bg,padding:32,fontFamily:T.font}}>
      <div style={{maxWidth:420,margin:"0 auto",paddingTop:40}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:32}}>
          <BackButton onClick={onBack}/>
          <ThemeToggle/>
        </div>
        <h1 style={{fontFamily:T.serif,fontSize:44,fontWeight:600,color:T.white,margin:"0 0 8px",letterSpacing:-.5}}>Request access.</h1>
        <p style={{color:T.grayDim,fontSize:14,margin:"0 0 32px"}}>Fill in your details and the Slapes will approve your subscription.</p>
        <Field label="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Jane Slape"/>
        <Field label="Phone or email" hint="So the Slapes can send you your private access link." value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="(555) 123-4567 or jane@example.com"/>
        <Field label="Message (optional)" textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})} placeholder="Say hello…"/>
        <Btn onClick={submit} icon={Icons.arrow} style={{width:"100%",justifyContent:"center"}}>Send request</Btn>
      </div>
      {toast && <Toast msg={toast} onDone={()=>setToast(null)}/>}
    </div>
  );
};

// Pick a readable ink color for text sitting on a filled brand color.
// Light accents (Chinese Lantern, Cassiopeia, Lynx) → deep-olive ink;
// dark accents (Sensaimidori) → light ink.
const INK_DARK  = "#172713"; // Deep Slate Olive
const INK_LIGHT = "#F7F7F7"; // Lynx White
function onColorInk(hex) {
  const h = hex.replace("#","");
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  const lum = (0.299*r + 0.587*g + 0.114*b);
  return lum > 120 ? INK_DARK : INK_LIGHT; // Lantern (166) & Cassiopeia (197) take dark ink; Sensai (61) takes light
}
// Translucent overlay tint that adapts to the ink color (for pills/insets on a color block)
const inkOverlay = (ink, a) => ink === INK_DARK ? `rgba(23,39,19,${a})` : `rgba(247,247,247,${a})`;

// ─── Featured Episode (magazine hero — large, editorial) ───────────────────────
const FeaturedEpisode = ({ episode, isOpen, onToggle }) => {
  const accent = HIGHLIGHT;              // orange — reserved for highlight elements
  const btnInk = onColorInk(accent);     // dark ink on the orange button
  const isVideo = episode.type === "video";
  return (
    <div style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:22,marginBottom:32,overflow:"hidden"}}>
      <div style={{padding:"30px 30px 28px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:6,background:accent,color:btnInk,fontSize:11,fontWeight:800,padding:"4px 11px",borderRadius:7,letterSpacing:.8,textTransform:"uppercase"}}>★ Latest</span>
          <span style={{display:"inline-flex",alignItems:"center",background:T.surface2,color:T.grayDim,fontSize:11,fontWeight:800,padding:"4px 10px",borderRadius:7,letterSpacing:.4,textTransform:"uppercase"}}>{isVideo ? "Vodcast" : "Podcast"}</span>
          <PublishedDate date={episode.date}/>
        </div>
        <h2 style={{margin:"0 0 12px",fontFamily:T.serif,fontSize:44,fontWeight:600,color:T.white,letterSpacing:-.5,lineHeight:1.02}}>{episode.title}</h2>
        {episode.notes && <p style={{margin:"0 0 24px",fontSize:15,color:T.grayDim,lineHeight:1.6,maxWidth:520,fontWeight:500}}>{episode.notes}</p>}
        <button onClick={onToggle} style={{display:"inline-flex",alignItems:"center",gap:10,padding:"13px 24px",borderRadius:12,background:accent,border:"none",cursor:"pointer",color:btnInk,fontFamily:T.font,fontWeight:700,fontSize:14}}>
          {isOpen
            ? <><Icon d={Icons.x} size={16} stroke={2.4}/> Close</>
            : <><Icon d={isVideo?Icons.video:Icons.play} size={16} fill={isVideo?"none":btnInk} color={btnInk} stroke={isVideo?2:0}/> {isVideo?"Watch":"Listen"} now</>
          }
        </button>
      </div>
      {isOpen && (
        <div style={{padding:"0 30px 28px"}}>
          <div style={{background:T.bg,border:`1px solid ${T.line}`,borderRadius:14,padding:"16px 18px"}}>
            {isVideo ? <VideoPlayer src={episode.url} accent={accent}/> : <AudioPlayer src={episode.url} accent={accent}/>}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Episode Row (flat, dark, color-tagged) ────────────────────────────────────
const EpisodeRow = ({ episode, index, isOpen, onToggle }) => {
  const accent = HIGHLIGHT;              // orange — highlight only (the play/watch control)
  const isVideo = episode.type === "video";
  const ctrlInk = onColorInk(accent);    // dark ink on the orange control
  return (
    // Vodcast cards span the full grid row so the embedded video plays large;
    // audio cards keep the compact multi-column layout.
    <div style={{background:T.surface,border:`1px solid ${isOpen?accent:T.line}`,borderRadius:16,marginBottom:0,overflow:"hidden",transition:"border-color .15s",...(isVideo?{gridColumn:"1 / -1"}:{})}}>
      <div style={{padding:"18px 20px",display:"flex",alignItems:"center",gap:14,cursor:"pointer"}} onClick={onToggle}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
            <span style={{display:"inline-flex",alignItems:"center",background:T.surface2,color:T.grayDim,fontSize:10,fontWeight:800,padding:"3px 8px",borderRadius:6,letterSpacing:.4,textTransform:"uppercase"}}>{isVideo ? "Vodcast" : "Podcast"}</span>
            <PublishedDate date={episode.date}/>
          </div>
          <h2 style={{margin:0,fontFamily:T.serif,fontSize:22,fontWeight:600,color:T.white,letterSpacing:-.2,lineHeight:1.2}}>{episode.title}</h2>
          {episode.notes && <p style={{margin:"5px 0 0",fontSize:13,color:T.grayDim,lineHeight:1.5,fontWeight:500}}>{episode.notes}</p>}
        </div>
        <div style={{flexShrink:0,width:46,height:46,borderRadius:"50%",background:accent,display:"flex",alignItems:"center",justifyContent:"center",color:ctrlInk}}>
          {isOpen
            ? <Icon d={Icons.x} size={18} stroke={2.4}/>
            : <Icon d={isVideo?Icons.video:Icons.play} size={18} fill={isVideo?"none":ctrlInk} color={ctrlInk} stroke={isVideo?2:0}/>
          }
        </div>
      </div>
      {isOpen && (
        <div style={{padding:"4px 20px 20px"}}>
          <div style={{background:T.bg,borderRadius:12,padding:"14px 16px"}}>
            {isVideo ? <VideoPlayer src={episode.url} accent={accent}/> : <AudioPlayer src={episode.url} accent={accent}/>}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Notifications opt-in (listener portal) ─────────────────────────────────────
// Lets each family member turn on free device notifications for new episodes.
// Handles the iOS quirk (push requires the site on the Home Screen first).
const NotificationsCard = ({ setToast }) => {
  const [state, setState] = useState("checking"); // checking|off|on|busy|ios-needs-install|unsupported|denied
  useEffect(() => {
    (async () => {
      const support = pushSupport();
      if (support !== "supported") { setState(support); return; }
      if (typeof Notification !== "undefined" && Notification.permission === "denied") { setState("denied"); return; }
      setState((await getPushSubscription()) ? "on" : "off");
    })();
  }, []);

  const turnOn = async () => {
    setState("busy");
    const res = await enablePush();
    if (res.ok) { setState("on"); setToast("Notifications on — you'll get a ping when new episodes drop! 🔔"); }
    else if (res.reason === "denied") { setState("denied"); }
    else { setState("off"); setToast("Couldn't turn on notifications — try again in a moment."); }
  };
  const turnOff = async () => { setState("busy"); await disablePush(); setState("off"); setToast("Notifications off."); };

  if (state === "checking" || state === "unsupported") return null;

  if (state === "on") return (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:28}}>
      <SoftTag color={T.accents.sage}><Icon d={Icons.bell} size={11} stroke={2.4}/> Notifications on</SoftTag>
      <button onClick={turnOff} style={{background:"none",border:"none",color:T.gray,cursor:"pointer",fontSize:12,fontFamily:T.font,padding:0}}>Turn off</button>
    </div>
  );

  return (
    <Panel style={{marginBottom:28,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
      <div style={{width:40,height:40,borderRadius:"50%",background:HIGHLIGHT+"22",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <Icon d={Icons.bell} size={18} color={HIGHLIGHT} stroke={2}/>
      </div>
      <div style={{flex:1,minWidth:220}}>
        <div style={{fontSize:14,fontWeight:700,color:T.white,marginBottom:2}}>Never miss a Sunday Sit Down</div>
        <div style={{fontSize:13,color:T.grayDim,lineHeight:1.5}}>
          {state === "ios-needs-install"
            ? <>On iPhone: tap <span style={{color:T.white,fontWeight:600}}>Share → Add to Home Screen</span>, then open the app from there and this button will appear.</>
            : state === "denied"
            ? <>Notifications are blocked for this site in your browser settings — allow them there, then come back.</>
            : <>Get a free notification on this device whenever a new episode drops.</>}
        </div>
      </div>
      {state !== "ios-needs-install" && state !== "denied" && (
        <Btn small onClick={turnOn} disabled={state === "busy"} icon={Icons.bell}>
          {state === "busy" ? "Turning on…" : "Turn on notifications"}
        </Btn>
      )}
    </Panel>
  );
};

// ─── Listener Portal ───────────────────────────────────────────────────────────
const ListenerPortal = ({ onGoSubscribe, welcomeName, onBack }) => {
  const [episodes, setEpisodes] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [toast, setToast] = useState(null);
  useEffect(()=>{ store.get("episodes").then(e=>setEpisodes(e||PLACEHOLDER_EPISODES)); },[]);
  const sorted = [...episodes].sort((a,b)=>new Date(b.date)-new Date(a.date));
  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:T.font}}>
      <div style={{maxWidth:1040,margin:"0 auto",padding:"40px 32px 60px"}}>
        {/* Header — SS icon solo (no box, no text) */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:44}}>
          <SSMonogram size={38}/>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <SoftTag color={T.accents.sage}>Private</SoftTag>
            <ThemeToggle/>
            {onBack && <BackButton onClick={onBack}/>}
          </div>
        </div>

        {/* Greeting — elegant serif */}
        <h1 style={{fontFamily:T.serif,fontSize:56,fontWeight:600,color:T.white,margin:"0 0 6px",letterSpacing:-1,lineHeight:1}}>
          {welcomeName ? `Hello, ${welcomeName.split(" ")[0]}.` : "Hello."}
        </h1>
        <p style={{fontSize:15,color:T.grayDim,margin:"0 0 28px"}}>
          {sorted.length} episode{sorted.length!==1?"s":""} to enjoy, newest first.
        </p>

        <NotificationsCard setToast={setToast}/>

        {sorted.length === 0
          ? <Panel style={{textAlign:"center",padding:"40px 24px"}}><p style={{color:T.gray,fontSize:15,margin:0}}>No episodes yet — check back soon.</p></Panel>
          : <>
              {/* Featured (latest) episode — magazine hero */}
              <FeaturedEpisode episode={sorted[0]} isOpen={openId===sorted[0].id} onToggle={()=>setOpenId(openId===sorted[0].id?null:sorted[0].id)}/>

              {/* The rest — tighter grid */}
              {sorted.length > 1 && <>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
                  <span style={{fontFamily:T.serif,fontSize:26,fontWeight:600,color:T.white,letterSpacing:-.3}}>More episodes</span>
                  <button onClick={onGoSubscribe} style={{display:"inline-flex",alignItems:"center",gap:6,background:"none",border:"none",color:T.gray,cursor:"pointer",fontSize:12,fontFamily:T.font}}>
                    <Icon d={Icons.share} size={13} stroke={2}/> Share
                  </button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(330px,1fr))",gap:14}}>
                  {sorted.slice(1).map((ep,i)=><EpisodeRow key={ep.id} episode={ep} index={i+1} isOpen={openId===ep.id} onToggle={()=>setOpenId(openId===ep.id?null:ep.id)}/>)}
                </div>
              </>}
            </>
        }
      </div>
      {toast && <Toast msg={toast} onDone={()=>setToast(null)}/>}
    </div>
  );
};

// ─── Admin: Episodes ───────────────────────────────────────────────────────────
const EpisodeManager = ({ episodes, setEpisodes, setToast }) => {
  const blank = { title:"", date:"", url:"", notes:"", type:"audio" };
  const [form, setForm] = useState(blank);
  const [adding, setAdding] = useState(false);
  const [sending, setSending] = useState(false);

  const save = async () => {
    if(!form.title||!form.url){setToast("Title and URL are required.");return;}
    const newEp={...form,id:Date.now()};
    const next=[...episodes,newEp];
    await store.set("episodes",next); setEpisodes(next); setForm(blank); setAdding(false);
    // Ping every device that turned notifications on (server-side Web Push).
    setSending(true); setToast("Episode saved! Notifying the family…");
    const res=await api({ action:"notify", episode:{ title:newEp.title, type:newEp.type } });
    if(res&&typeof res.sent==="number"){
      setToast(res.total===0
        ? "Episode saved! (No devices have notifications on yet.)"
        : `Episode saved! Notified ${res.sent} device${res.sent!==1?"s":""}${res.failed?` (${res.failed} unreachable)`:""} ✓`);
    } else {
      setToast("Episode saved! (Couldn't send notifications — backend unreachable.)");
    }
    setSending(false);
  };
  const remove = async (id) => { const next=episodes.filter(e=>e.id!==id); await store.set("episodes",next); setEpisodes(next); setToast("Episode removed."); };

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h2 style={{margin:0,fontFamily:T.serif,fontSize:28,fontWeight:600,color:T.white,letterSpacing:-.3}}>Episodes</h2>
        <Btn small variant={adding?"ghost":"primary"} icon={adding?Icons.x:Icons.plus} onClick={()=>setAdding(!adding)}>{adding?"Cancel":"Add episode"}</Btn>
      </div>

      {adding && (
        <Panel style={{border:`1px solid ${T.accents.marigold}44`}}>
          <div style={{display:"flex",gap:10,marginBottom:18}}>
            {[{v:"audio",label:"Podcast",icon:Icons.mic},{v:"video",label:"Vodcast",icon:Icons.film}].map(t=>(
              <button key={t.v} onClick={()=>setForm({...form,type:t.v})} style={{display:"inline-flex",alignItems:"center",gap:7,padding:"8px 16px",borderRadius:24,background:form.type===t.v?T.accents.sand:"transparent",color:form.type===t.v?"#172713":T.grayDim,fontFamily:T.font,fontSize:13,fontWeight:600,cursor:"pointer",border:`1px solid ${form.type===t.v?T.accents.sand:T.line}`}}>
                <Icon d={t.icon} size={15} stroke={2}/>{t.label}
              </button>
            ))}
          </div>
          <Field label="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Episode title"/>
          <Field label="Date" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
          {form.type==="video"
            ? <Field label="YouTube link" hint="Upload the video to YouTube as Unlisted or Private, then paste the share link here." value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder="https://youtu.be/… or https://youtube.com/watch?v=…"/>
            : <Field label="Audio file URL" hint="Direct link to the audio file — .mp3 or .m4a (e.g. your Cloudflare R2 public URL)." value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder="https://media.yoursite.com/episode.mp3"/>
          }
          {form.type==="video" && form.url && !isYouTubeUrl(form.url) &&
            <div style={{fontSize:12,color:T.accents.vermilion,margin:"-8px 0 14px",fontWeight:600}}>That doesn't look like a YouTube link — double-check the URL.</div>
          }
          <Field label="Show notes" textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="What's this episode about?"/>
          <Btn onClick={save} disabled={sending} icon={Icons.check}>{sending?"Saving…":"Save & notify the family"}</Btn>
        </Panel>
      )}

      {[...episodes].sort((a,b)=>new Date(b.date)-new Date(a.date)).map((ep,i)=>{
        const isVid = ep.type==="video";
        return (
          <div key={ep.id} style={{background:T.surface,border:`1px solid ${T.line}`,borderRadius:14,padding:"16px 18px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:7}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:5,background:T.surface2,color:T.grayDim,fontSize:10,fontWeight:800,padding:"3px 8px",borderRadius:6,letterSpacing:.4,textTransform:"uppercase"}}><span style={{width:6,height:6,borderRadius:"50%",background:HIGHLIGHT}}/>{isVid?"Vodcast":"Podcast"}</span>
                  <span style={{fontSize:12,color:T.gray,fontWeight:600}}>{prettyDate(ep.date)}</span>
                </div>
                <div style={{fontFamily:T.serif,fontWeight:600,color:T.white,fontSize:20,letterSpacing:-.2,lineHeight:1.2}}>{ep.title}</div>
                {ep.notes&&<div style={{fontSize:13,color:T.grayDim,marginTop:3,fontWeight:500}}>{ep.notes}</div>}
              </div>
              <button onClick={()=>remove(ep.id)} title="Remove" style={{background:"none",border:`1px solid ${T.line}`,borderRadius:9,padding:8,cursor:"pointer",color:T.grayDim,display:"flex",flexShrink:0}}>
                <Icon d={Icons.trash} size={16} stroke={2}/>
              </button>
            </div>
          </div>
        );
      })}
      {episodes.length===0&&<p style={{color:T.gray,fontSize:14}}>No episodes yet.</p>}
    </div>
  );
};

// ─── Admin: Subscribers ────────────────────────────────────────────────────────
const SubscriberManager = ({ setToast }) => {
  const [subscribers,setSubscribers]=useState([]);
  const [requests,setRequests]=useState([]);
  const [addForm,setAddForm]=useState({name:"",email:""});
  const [adding,setAdding]=useState(false);

  useEffect(()=>{
    store.get("subscribers").then(async s=>{
      const list=s||[]; let changed=false;
      const withTokens=list.map(sub=>{ if(!sub.token){changed=true;return {...sub,token:makeToken()};} return sub; });
      if(changed) await store.set("subscribers",withTokens);
      setSubscribers(withTokens);
    });
    store.get("subscribe_requests").then(r=>setRequests(r||[]));
  },[]);

  const approve=async(req)=>{
    const newSub={id:req.id,name:req.name,email:req.email,token:makeToken(),addedAt:new Date().toISOString()};
    const nextSubs=[...subscribers,newSub],nextReqs=requests.map(r=>r.id===req.id?{...r,status:"approved"}:r);
    await store.set("subscribers",nextSubs);await store.set("subscribe_requests",nextReqs);
    setSubscribers(nextSubs);setRequests(nextReqs);setToast(`${req.name} approved!`);
  };
  const deny=async(req)=>{ const nextReqs=requests.map(r=>r.id===req.id?{...r,status:"denied"}:r); await store.set("subscribe_requests",nextReqs);setRequests(nextReqs);setToast(`${req.name} denied.`); };
  const removeSub=async(id)=>{ const next=subscribers.filter(s=>s.id!==id); await store.set("subscribers",next);setSubscribers(next);setToast("Removed."); };
  const addManual=async()=>{
    if(!addForm.name||!addForm.email){setToast("Name and contact info required.");return;}
    const next=[...subscribers,{...addForm,id:Date.now(),token:makeToken(),addedAt:new Date().toISOString()}];
    await store.set("subscribers",next);setSubscribers(next);setAddForm({name:"",email:""});setAdding(false);setToast("Added!");
  };
  const copyLink=async(sub)=>{ const link=buildMagicLink(sub.token); try{await navigator.clipboard.writeText(link);setToast(`Copied ${sub.name}'s magic link!`);}catch{setToast(link);} };
  const regenerate=async(id)=>{ const next=subscribers.map(s=>s.id===id?{...s,token:makeToken()}:s); await store.set("subscribers",next);setSubscribers(next);setToast("New link generated — old one no longer works."); };

  const pending=requests.filter(r=>r.status==="pending");
  return (
    <div>
      {pending.length>0&&(
        <div style={{marginBottom:28}}>
          <h2 style={{margin:"0 0 14px",fontFamily:T.serif,fontSize:24,fontWeight:600,color:T.white,display:"flex",alignItems:"center",gap:10}}>
            Pending <Tag color={T.accents.marigold}>{pending.length}</Tag>
          </h2>
          {pending.map(req=>(
            <div key={req.id} style={{background:T.accents.marigold,borderRadius:14,padding:"16px 18px",marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
                <div>
                  <div style={{fontWeight:800,color:"#172713",fontSize:15}}>{req.name}</div>
                  <div style={{fontSize:13,color:"#172713",opacity:.75,fontWeight:600}}>{req.email}</div>
                  {req.message&&<div style={{fontSize:12,color:"#172713",opacity:.7,marginTop:4,fontStyle:"italic"}}>"{req.message}"</div>}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>approve(req)} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:9,background:"#172713",color:T.accents.marigold,border:"none",cursor:"pointer",fontFamily:T.font,fontWeight:700,fontSize:13}}><Icon d={Icons.check} size={15} stroke={2.4}/> Approve</button>
                  <button onClick={()=>deny(req)} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:9,background:"rgba(23,39,19,.16)",color:"#172713",border:"none",cursor:"pointer",fontFamily:T.font,fontWeight:700,fontSize:13}}><Icon d={Icons.x} size={15} stroke={2.4}/> Deny</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h2 style={{margin:0,fontFamily:T.serif,fontSize:24,fontWeight:600,color:T.white,display:"flex",alignItems:"center",gap:10}}>
          Subscribers <Tag color={T.accents.sage}>{subscribers.length}</Tag>
        </h2>
        <Btn small variant={adding?"ghost":"primary"} icon={adding?Icons.x:Icons.plus} onClick={()=>setAdding(!adding)}>{adding?"Cancel":"Add"}</Btn>
      </div>

      {adding&&(
        <Panel>
          <Field label="Name" value={addForm.name} onChange={e=>setAddForm({...addForm,name:e.target.value})}/>
          <Field label="Phone or email" value={addForm.email} onChange={e=>setAddForm({...addForm,email:e.target.value})}/>
          <Btn onClick={addManual} icon={Icons.plus}>Add subscriber</Btn>
        </Panel>
      )}

      {subscribers.map((sub,i)=>{
        const accent=HIGHLIGHT;
        return (
        <Panel key={sub.id} style={{borderLeft:`4px solid ${accent}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:11}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:accent,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:T.serif,fontWeight:600,fontSize:16,color:onColorInk(accent)}}>{(sub.name||"?").charAt(0).toUpperCase()}</div>
              <div><div style={{fontWeight:700,color:T.white}}>{sub.name}</div><div style={{fontSize:13,color:T.grayDim}}>{sub.email}</div></div>
            </div>
            <button onClick={()=>removeSub(sub.id)} title="Remove" style={{background:"none",border:`1px solid ${T.line}`,borderRadius:9,padding:8,cursor:"pointer",color:T.accents.vermilion,display:"flex"}}>
              <Icon d={Icons.trash} size={16} stroke={2}/>
            </button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,background:T.bg,borderRadius:10,padding:"8px 10px",border:`1px solid ${T.line}`}}>
            <Icon d={Icons.link} size={14} color={T.gray} stroke={2}/>
            <code style={{flex:1,fontSize:11,color:T.gray,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{buildMagicLink(sub.token)}</code>
            <button onClick={()=>copyLink(sub)} title="Copy link" style={{background:"none",border:"none",cursor:"pointer",color:T.grayDim,display:"flex",padding:4}}><Icon d={Icons.copy} size={15} stroke={2}/></button>
            <button onClick={()=>regenerate(sub.id)} title="Generate new link" style={{background:"none",border:"none",cursor:"pointer",color:T.grayDim,display:"flex",padding:4}}><Icon d={Icons.refresh} size={15} stroke={2}/></button>
          </div>
        </Panel>
        );
      })}
      {subscribers.length===0&&<p style={{color:T.gray,fontSize:14}}>No subscribers yet.</p>}
    </div>
  );
};

// ─── Admin: Settings ───────────────────────────────────────────────────────────
const SettingsPanel = ({ setToast }) => {
  const [adminPw,setAdminPw]=useState("");
  const [listenerPw,setListenerPw]=useState("");
  const [deviceCount,setDeviceCount]=useState(null);
  const [testing,setTesting]=useState(false);
  useEffect(()=>{ api({action:"push_status"}).then(r=>{ if(r&&typeof r.count==="number") setDeviceCount(r.count); }); },[]);
  const savePw=async()=>{ if(adminPw)await store.set("admin_pw",adminPw); if(listenerPw)await store.set("listener_pw",listenerPw); setAdminPw("");setListenerPw("");setToast("Passwords updated!"); };
  const sendTest=async()=>{
    setTesting(true);
    const r=await api({action:"notify",test:true});
    setTesting(false);
    if(r&&typeof r.sent==="number") setToast(r.total===0?"No devices subscribed yet — turn notifications on from the Listen page first.":`Test sent to ${r.sent} device${r.sent!==1?"s":""}${r.failed?` (${r.failed} unreachable)`:""} ✓`);
    else setToast("Couldn't send — shared backend unreachable.");
  };

  return (
    <div>
      <h2 style={{margin:"0 0 20px",fontFamily:T.serif,fontSize:28,fontWeight:600,color:T.white,letterSpacing:-.3}}>Settings</h2>

      <Panel>
        <h3 style={{margin:"0 0 6px",fontSize:15,fontWeight:700,color:T.white,display:"flex",alignItems:"center",gap:8}}>
          <Icon d={Icons.bell} size={16} color={HIGHLIGHT} stroke={2}/> New-episode notifications (free)
        </h3>
        <p style={{fontSize:13,color:T.grayDim,margin:"0 0 16px",lineHeight:1.7}}>
          Notifications are sent straight to family members' devices — no email accounts, no phone numbers, nothing to configure here.
          Each person turns them on once from the <span style={{color:T.white,fontWeight:600}}>Listen &amp; Watch</span> page ("Turn on notifications").
          On iPhone they'll first add the site to their Home Screen (Share → Add to Home Screen).
          When you save a new episode, every subscribed device gets a ping automatically.
        </p>
        <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <Btn small onClick={sendTest} disabled={testing} icon={Icons.bell}>{testing?"Sending…":"Send test notification"}</Btn>
          {deviceCount!==null && (
            <SoftTag color={T.accents.sage}>{deviceCount} device{deviceCount!==1?"s":""} subscribed</SoftTag>
          )}
        </div>
      </Panel>

      <Panel>
        <h3 style={{margin:"0 0 8px",fontSize:14,fontWeight:700,color:T.white}}>Where to host episodes</h3>
        <p style={{fontSize:13,color:T.grayDim,margin:"0 0 12px",lineHeight:1.7}}>
          <span style={{color:T.white,fontWeight:600}}>Audio (Podcast):</span> upload your <span style={{color:T.white}}>.mp3 or .m4a</span> to a file host that gives a direct link — Cloudflare R2 is a good free option (generous storage, no egress fees, streams and seeks cleanly). Paste that direct URL into the episode's <span style={{color:T.white}}>Audio file URL</span> field.
        </p>
        <p style={{fontSize:13,color:T.grayDim,margin:0,lineHeight:1.7}}>
          <span style={{color:T.white,fontWeight:600}}>Video (Vodcast):</span> upload to YouTube set to <span style={{color:T.white}}>Unlisted</span> or <span style={{color:T.white}}>Private</span>, then paste the share link into the episode's <span style={{color:T.white}}>YouTube link</span> field. It embeds right on the site behind your password.
        </p>
      </Panel>

      <Panel>
        <h3 style={{margin:"0 0 14px",fontSize:15,fontWeight:700,color:T.white}}>Passwords</h3>
        <Field label="New admin password"    type="password" value={adminPw}    onChange={e=>setAdminPw(e.target.value)}    placeholder="Leave blank to keep current"/>
        <Field label="New listener password" type="password" value={listenerPw} onChange={e=>setListenerPw(e.target.value)} placeholder="Leave blank to keep current"/>
        <Btn onClick={savePw} icon={Icons.lock}>Save passwords</Btn>
      </Panel>
    </div>
  );
};

// ─── Admin Dashboard ───────────────────────────────────────────────────────────
const AdminDashboard = ({ onLogout }) => {
  const [tab,setTab]=useState("episodes");
  const [episodes,setEpisodes]=useState([]);
  const [toast,setToast]=useState(null);
  useEffect(()=>{ store.get("episodes").then(e=>setEpisodes(e||PLACEHOLDER_EPISODES)); },[]);
  const tabs=[{k:"episodes",label:"Episodes",icon:Icons.mic},{k:"subscribers",label:"Subscribers",icon:Icons.users},{k:"settings",label:"Settings",icon:Icons.settings}];
  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:T.font}}>
      <div style={{borderBottom:`1px solid ${T.line}`}}>
        <div style={{maxWidth:760,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:60,padding:"0 24px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <SSMonogram size={30}/>
            <SoftTag color={T.accents.marigold}>Admin</SoftTag>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <ThemeToggle/>
            <button onClick={onLogout} style={{display:"inline-flex",alignItems:"center",gap:7,background:"none",border:`1px solid ${T.line}`,borderRadius:9,padding:"7px 12px",color:T.grayDim,cursor:"pointer",fontSize:13,fontFamily:T.font}}>
              <Icon d={Icons.logout} size={15} stroke={2}/> Log out
            </button>
          </div>
        </div>
      </div>
      <div style={{borderBottom:`1px solid ${T.line}`}}>
        <div style={{maxWidth:760,margin:"0 auto",display:"flex",padding:"0 24px"}}>
          {tabs.map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)} style={{display:"inline-flex",alignItems:"center",gap:8,padding:"15px 16px",border:"none",background:"none",cursor:"pointer",fontFamily:T.font,fontSize:13,fontWeight:600,color:tab===t.k?T.white:T.gray,borderBottom:tab===t.k?`2px solid ${T.accents.marigold}`:"2px solid transparent",transition:"color .15s"}}>
              <Icon d={t.icon} size={15} stroke={2}/>{t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{maxWidth:760,margin:"0 auto",padding:"32px 24px"}}>
        {tab==="episodes"    && <EpisodeManager episodes={episodes} setEpisodes={setEpisodes} setToast={setToast}/>}
        {tab==="subscribers" && <SubscriberManager setToast={setToast}/>}
        {tab==="settings"    && <SettingsPanel setToast={setToast}/>}
      </div>
      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
    </div>
  );
};

// ─── Home ──────────────────────────────────────────────────────────────────────
const HomePage = ({ onListen, onSubscribe, onAdmin }) => (
  <div style={{minHeight:"100vh",background:T.bg,fontFamily:T.font,display:"flex",flexDirection:"column",padding:"40px 32px"}}>
    <div style={{width:"100%",maxWidth:1100,margin:"0 auto",flex:1,display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:T.accents.sage,display:"inline-block"}}/>
          <div style={{fontSize:12,color:T.gray,fontFamily:T.font}}>Private · family only</div>
        </div>
        <ThemeToggle/>
      </div>

      <div style={{maxWidth:480}}>
        <ScriptTitle style={{margin:"0 0 28px"}}/>
        <p style={{fontFamily:T.serif,fontSize:22,color:T.grayDim,margin:"0 0 36px",lineHeight:1.4,fontWeight:400,maxWidth:400}}>
          A private podcast for family.
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:360}}>
          <button onClick={onListen} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"15px 22px",borderRadius:12,background:HIGHLIGHT,color:onColorInk(HIGHLIGHT),fontFamily:T.font,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>
            Listen &amp; Watch <Icon d={Icons.arrow} size={18} stroke={2.2}/>
          </button>
          <button onClick={onSubscribe} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"15px 22px",borderRadius:12,background:T.surface,color:T.white,fontFamily:T.font,fontWeight:600,fontSize:15,border:`1px solid ${T.line}`,cursor:"pointer"}}>
            Request access <Icon d={Icons.arrow} size={18} stroke={2.2}/>
          </button>
          <button onClick={onAdmin} style={{display:"inline-flex",alignItems:"center",gap:7,background:"none",border:"none",color:T.gray,cursor:"pointer",fontSize:12,fontFamily:T.font,marginTop:8,alignSelf:"flex-start"}}>
            <Icon d={Icons.lock} size={13} stroke={2}/> Admin
          </button>
        </div>
      </div>
      <div style={{marginTop:"auto"}}/>
    </div>
  </div>
);

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,setScreen]=useState("home");
  const [listenerUnlocked,setListenerUnlocked]=useState(false);
  const [adminUnlocked,setAdminUnlocked]=useState(false);
  const [checkingLink,setCheckingLink]=useState(true);
  const [welcomeName,setWelcomeName]=useState(null);

  useEffect(()=>{
    // Keep the push service worker registered on every visit so devices that
    // opted in keep receiving new-episode notifications.
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{});
    (async()=>{
      // Magic-link token from the URL, else the per-device remembered token.
      // Matching happens server-side so the subscriber list never leaves the backend.
      const urlToken=getUrlToken();
      let token=urlToken, matched=urlToken?await matchToken(urlToken):null;
      if(!matched){ const remembered=localGet(REMEMBER_KEY); if(remembered){ matched=await matchToken(remembered); token=remembered; } }
      if(matched){ localSet(REMEMBER_KEY,token); setListenerUnlocked(true); setScreen("listen"); setWelcomeName(matched.name); }
      setCheckingLink(false);
    })();
  },[]);

  if (checkingLink) return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.font}}>
      <span style={{fontSize:15,color:T.gray}}>Loading…</span>
    </div>
  );

  if (screen==="home")      return <HomePage onListen={()=>setScreen("listen")} onSubscribe={()=>setScreen("subscribe")} onAdmin={()=>setScreen("admin")}/>;
  if (screen==="subscribe") return <SubscribePage onBack={()=>setScreen("home")}/>;

  if (screen==="listen") {
    if (!listenerUnlocked) return <LockScreen isAdmin={false} onBack={()=>setScreen("home")}
      onSubmit={async(pw)=>{ const role=await verifyPassword(pw); if(role){setListenerUnlocked(true);return true;} return false; }}
      onSimulateMagicLink={async()=>{
        // Preview-only shortcut; subscriber names aren't public on the shared
        // backend, so this may unlock without a name there.
        const subs=(await store.get("subscribers"))||[]; const who=Array.isArray(subs)?subs[0]:null;
        if(who){ localSet(REMEMBER_KEY,who.token); setWelcomeName(who.name); }
        setListenerUnlocked(true);
      }}/>;
    return <ListenerPortal onGoSubscribe={()=>setScreen("subscribe")} welcomeName={welcomeName} onBack={()=>setScreen("home")}/>;
  }

  if (screen==="admin") {
    if (!adminUnlocked) return <LockScreen isAdmin={true} onBack={()=>setScreen("home")}
      onSubmit={async(pw)=>{ const role=await verifyPassword(pw); if(role==="admin"){setAdminUnlocked(true);return true;} return false; }}/>;
    return <AdminDashboard onLogout={()=>{adminSecret="";setAdminUnlocked(false);setScreen("home");}}/>;
  }
  return null;
}
