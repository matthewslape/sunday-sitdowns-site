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

// ─── EmailJS ───────────────────────────────────────────────────────────────────
let emailjsReady = false;
function loadEmailJS() {
  if (emailjsReady || document.getElementById("emailjs-sdk")) return Promise.resolve();
  return new Promise((res) => {
    const s = document.createElement("script");
    s.id = "emailjs-sdk";
    s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    s.onload = () => { emailjsReady = true; res(); };
    document.head.appendChild(s);
  });
}
async function sendEpisodeEmails(subscribers, episode, credentials) {
  await loadEmailJS();
  const { serviceId, templateId, publicKey } = credentials;
  window.emailjs.init({ publicKey });
  const results = await Promise.allSettled(
    subscribers.filter(s => s.email).map(s =>
      window.emailjs.send(serviceId, templateId, {
        to_email: s.email, to_name: s.name,
        episode_title: episode.title, episode_date: episode.date,
        episode_notes: episode.notes || "", episode_url: episode.url,
        episode_type: episode.type === "video" ? "Vodcast (Video)" : "Podcast (Audio)",
        magic_link: s.token ? buildMagicLink(s.token) : buildMagicLink(""),
      })
    )
  );
  return {
    sent:   results.filter(r => r.status === "fulfilled").length,
    failed: results.filter(r => r.status === "rejected").length,
  };
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
        <video src={src} controls controlsList="nodownload" onError={()=>setFailed(true)} style={{width:"100%",display:"block",maxHeight:420}} preload="metadata"/>
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
const ScriptTitle = ({ width=320, style={} }) => (
  <img src="/brand/wordmark-script.png" alt="Sunday Sit Downs with the Slape&apos;s"
       style={{width,height:"auto",display:"block",filter:"var(--logo-filter)",...style}}/>
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
              <span style={{color:T.grayDim,fontWeight:600}}>Preview note:</span> Family members won't normally see this — their email link logs them in automatically. Tap to simulate that.
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
    if(!form.name||!form.email){setToast("Please fill in your name and email.");return;}
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
        <Field label="Email address" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="jane@example.com"/>
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
          <span style={{fontSize:12,color:T.gray,fontWeight:600}}>{prettyDate(episode.date)}</span>
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
    <div style={{background:T.surface,border:`1px solid ${isOpen?accent:T.line}`,borderRadius:16,marginBottom:0,overflow:"hidden",transition:"border-color .15s"}}>
      <div style={{padding:"18px 20px",display:"flex",alignItems:"center",gap:14,cursor:"pointer"}} onClick={onToggle}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
            <span style={{display:"inline-flex",alignItems:"center",background:T.surface2,color:T.grayDim,fontSize:10,fontWeight:800,padding:"3px 8px",borderRadius:6,letterSpacing:.4,textTransform:"uppercase"}}>{isVideo ? "Vodcast" : "Podcast"}</span>
            <span style={{fontSize:12,color:T.gray,fontWeight:600}}>{prettyDate(episode.date)}</span>
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

// ─── Listener Portal ───────────────────────────────────────────────────────────
const ListenerPortal = ({ onGoSubscribe, welcomeName, onBack }) => {
  const [episodes, setEpisodes] = useState([]);
  const [openId, setOpenId] = useState(null);
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
        <p style={{fontSize:15,color:T.grayDim,margin:"0 0 44px"}}>
          {sorted.length} episode{sorted.length!==1?"s":""} to enjoy, newest first.
        </p>

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
    const creds=await store.get("emailjs_creds");
    if(!creds||!creds.serviceId){setToast("Episode saved! (Add EmailJS in Settings to auto-email.)");return;}
    const subs=((await store.get("subscribers"))||[]).filter(s=>s.email);
    if(!subs.length){setToast("Episode saved! No subscribers to email yet.");return;}
    setSending(true); setToast(`Emailing ${subs.length} subscriber${subs.length!==1?"s":""}…`);
    try{ const {sent,failed}=await sendEpisodeEmails(subs,newEp,creds); setToast(`Emailed ${sent}${failed>0?` (${failed} failed)`:""} ✓`); }
    catch{ setToast("Episode saved, but email failed. Check Settings."); }
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
          <Btn onClick={save} disabled={sending} icon={Icons.check}>{sending?"Saving…":"Save & notify subscribers"}</Btn>
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
    if(!addForm.name||!addForm.email){setToast("Name and email required.");return;}
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
          <Field label="Email" type="email" value={addForm.email} onChange={e=>setAddForm({...addForm,email:e.target.value})}/>
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
  const [creds,setCreds]=useState({serviceId:"",templateId:"",publicKey:""});
  const [credsLoaded,setCredsLoaded]=useState(false);
  useEffect(()=>{ store.get("emailjs_creds").then(c=>{if(c)setCreds(c);setCredsLoaded(true);}); },[]);
  const savePw=async()=>{ if(adminPw)await store.set("admin_pw",adminPw); if(listenerPw)await store.set("listener_pw",listenerPw); setAdminPw("");setListenerPw("");setToast("Passwords updated!"); };
  const saveCreds=async()=>{ if(!creds.serviceId||!creds.templateId||!creds.publicKey){setToast("Fill in all three fields.");return;} await store.set("emailjs_creds",creds); setToast("Email settings saved!"); };

  return (
    <div>
      <h2 style={{margin:"0 0 20px",fontFamily:T.serif,fontSize:28,fontWeight:600,color:T.white,letterSpacing:-.3}}>Settings</h2>

      <Panel>
        <h3 style={{margin:"0 0 6px",fontSize:15,fontWeight:700,color:T.white,display:"flex",alignItems:"center",gap:8}}>
          <Icon d={Icons.link} size={16} color={T.accents.turquoise} stroke={2}/> Email (EmailJS — free)
        </h3>
        <p style={{fontSize:13,color:T.grayDim,margin:"0 0 16px",lineHeight:1.7}}>
          <a href="https://emailjs.com" target="_blank" rel="noreferrer" style={{color:T.accents.turquoise}}>Create a free account at emailjs.com</a> → connect Gmail → create a Template → paste IDs below.<br/><br/>
          Template variables: {["{{to_name}}","{{episode_title}}","{{episode_date}}","{{episode_notes}}","{{episode_url}}","{{episode_type}}","{{magic_link}}"].map(v=>(
            <code key={v} style={{background:T.surface2,padding:"2px 6px",borderRadius:4,fontSize:11,marginRight:4,color:T.grayDim}}>{v}</code>
          ))}
        </p>
        {credsLoaded&&<>
          <Field label="Service ID"  value={creds.serviceId}  onChange={e=>setCreds({...creds,serviceId:e.target.value})}  placeholder="service_xxxxxxx"/>
          <Field label="Template ID" value={creds.templateId} onChange={e=>setCreds({...creds,templateId:e.target.value})} placeholder="template_xxxxxxx"/>
          <Field label="Public Key"  value={creds.publicKey}  onChange={e=>setCreds({...creds,publicKey:e.target.value})}  placeholder="Your public key"/>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <Btn onClick={saveCreds} icon={Icons.check}>Save</Btn>
            {creds.serviceId&&<span style={{fontSize:13,color:T.accents.sage,fontWeight:600,display:"inline-flex",alignItems:"center",gap:5}}><Icon d={Icons.check} size={14} color={T.accents.sage} stroke={2.5}/>Configured</span>}
          </div>
        </>}
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
        <ScriptTitle width={360} style={{margin:"0 0 28px"}}/>
        <p style={{fontFamily:T.serif,fontSize:22,color:T.grayDim,margin:"0 0 36px",lineHeight:1.4,fontWeight:400,maxWidth:400}}>
          A private podcast for family.
        </p>
        <div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:360}}>
          <button onClick={onListen} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"15px 22px",borderRadius:12,background:T.white,color:T.bg,fontFamily:T.font,fontWeight:700,fontSize:15,border:"none",cursor:"pointer"}}>
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
