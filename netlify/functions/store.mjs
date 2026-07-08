// ─── Shared storage API ─────────────────────────────────────────────────────────
// Netlify Function backed by Netlify Blobs. This is the shared backend that
// replaces the per-browser localStorage shim: episodes, subscribers, access
// requests, and settings live here, so every family member sees the same data
// on every device.
//
// Access rules:
//   - `episodes` is readable by anyone (playback URLs were always client-visible).
//   - `subscribers`, `subscribe_requests`, and `emailjs_creds` require the
//     admin password.
//   - Passwords are NEVER returned to the client. Login happens via the
//     `verify` action; magic-link tokens are matched via `token`.
//   - All writes require the admin password, except `request` (the public
//     "request access" form), which can only append a pending request.

import { getStore } from "@netlify/blobs";

const DEFAULT_ADMIN_PW = "admin123";
const DEFAULT_LISTENER_PW = "family2024";

// Keys only the admin may read.
const ADMIN_READ_KEYS = new Set(["subscribers", "subscribe_requests", "emailjs_creds"]);
// Keys that must never leave the server.
const SECRET_KEYS = new Set(["admin_pw", "listener_pw"]);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

// In-memory fallback so the function still responds when the Blobs
// environment isn't available (e.g. local `netlify dev` without a linked
// site). Non-persistent — production always uses real Blobs.
function memoryStore() {
  const m = new Map();
  return {
    get: async (k) => (m.has(k) ? m.get(k) : null),
    set: async (k, v) => { m.set(k, v); },
  };
}

let blobs;
function store() {
  if (!blobs) {
    try { blobs = getStore("sunday-sit-downs"); }
    catch { blobs = memoryStore(); }
  }
  return blobs;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: "invalid JSON" }, 400); }

  const db = store();
  const read = async (key) => {
    const raw = await db.get(key);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  };

  const adminPw = (await read("admin_pw")) || DEFAULT_ADMIN_PW;
  const listenerPw = (await read("listener_pw")) || DEFAULT_LISTENER_PW;
  const isAdmin = typeof body.adminPw === "string" && body.adminPw === adminPw;

  switch (body.action) {
    // Login: return the role for a password, never the passwords themselves.
    case "verify": {
      const pw = String(body.password ?? "");
      const role = pw && pw === adminPw ? "admin" : pw && pw === listenerPw ? "listener" : null;
      return json({ role });
    }

    // Magic-link login: match a subscriber token, return only their name.
    case "token": {
      const t = String(body.token ?? "");
      if (!t) return json({ match: null });
      const subs = (await read("subscribers")) || [];
      const m = Array.isArray(subs) ? subs.find((s) => s && s.token === t) : null;
      return json({ match: m ? { name: m.name } : null });
    }

    // Public "request access" form: append-only, no read access.
    case "request": {
      const name = String(body.name ?? "").trim().slice(0, 120);
      const email = String(body.email ?? "").trim().slice(0, 200);
      const message = String(body.message ?? "").trim().slice(0, 1000);
      if (!name || !email) return json({ error: "name and email required" }, 400);
      const reqs = (await read("subscribe_requests")) || [];
      reqs.push({ name, email, message, id: Date.now(), status: "pending", requestedAt: new Date().toISOString() });
      await db.set("subscribe_requests", JSON.stringify(reqs));
      return json({ ok: true });
    }

    case "get": {
      const key = String(body.key ?? "");
      if (!key || SECRET_KEYS.has(key)) return json({ error: "forbidden" }, 403);
      if (ADMIN_READ_KEYS.has(key) && !isAdmin) return json({ error: "forbidden" }, 403);
      return json({ value: await read(key) });
    }

    case "set": {
      if (!isAdmin) return json({ error: "forbidden" }, 403);
      const key = String(body.key ?? "");
      if (!key) return json({ error: "key required" }, 400);
      await db.set(key, JSON.stringify(body.value ?? null));
      return json({ ok: true });
    }

    default:
      return json({ error: "unknown action" }, 400);
  }
};

export const config = { path: "/api/store" };
