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
import webpush from "web-push";

const DEFAULT_ADMIN_PW = "admin123";
const DEFAULT_LISTENER_PW = "family2024";

// Cap on stored push subscriptions — plenty for a family, blocks abuse.
const MAX_PUSH_SUBS = 200;

// Keys only the admin may read.
const ADMIN_READ_KEYS = new Set(["subscribers", "subscribe_requests", "emailjs_creds"]);
// Keys that must never leave the server. `vapid_keys` holds the push
// signing keypair; `push_subs` holds device push subscriptions (their
// endpoints are capability URLs — anyone holding one can send that device
// notifications, so they stay server-side).
const SECRET_KEYS = new Set(["admin_pw", "listener_pw", "vapid_keys", "push_subs"]);

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

  // VAPID keypair for Web Push — generated once on first use, then reused.
  // The private key never leaves the server.
  const getVapid = async () => {
    let keys = await read("vapid_keys");
    if (!keys || !keys.publicKey || !keys.privateKey) {
      keys = webpush.generateVAPIDKeys();
      await db.set("vapid_keys", JSON.stringify(keys));
    }
    return keys;
  };
  // VAPID subject: the site URL on Netlify, a mailto fallback elsewhere.
  const vapidSubject = (process.env.URL && process.env.URL.startsWith("https://"))
    ? process.env.URL
    : "mailto:admin@example.com";

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

    // ── Web Push notifications ────────────────────────────────────────────
    // Public key for the browser's pushManager.subscribe call.
    case "vapid_public": {
      const { publicKey } = await getVapid();
      return json({ publicKey });
    }

    // Store a device's push subscription. Public (family members subscribe
    // from the listener portal); validated + capped.
    case "push_subscribe": {
      const s = body.subscription;
      const endpoint = s && typeof s.endpoint === "string" ? s.endpoint : "";
      const p256dh = s && s.keys && typeof s.keys.p256dh === "string" ? s.keys.p256dh : "";
      const auth = s && s.keys && typeof s.keys.auth === "string" ? s.keys.auth : "";
      if (!endpoint.startsWith("https://") || endpoint.length > 1000 || !p256dh || !auth
          || p256dh.length > 300 || auth.length > 300) {
        return json({ error: "invalid subscription" }, 400);
      }
      const subs = ((await read("push_subs")) || []).filter((x) => x && x.endpoint !== endpoint);
      if (subs.length >= MAX_PUSH_SUBS) return json({ error: "subscription limit reached" }, 429);
      subs.push({ endpoint, keys: { p256dh, auth }, addedAt: new Date().toISOString() });
      await db.set("push_subs", JSON.stringify(subs));
      return json({ ok: true });
    }

    // Remove a device's subscription (listener turned notifications off).
    case "push_unsubscribe": {
      const endpoint = String(body.endpoint ?? "");
      if (!endpoint) return json({ error: "endpoint required" }, 400);
      const subs = ((await read("push_subs")) || []).filter((x) => x && x.endpoint !== endpoint);
      await db.set("push_subs", JSON.stringify(subs));
      return json({ ok: true });
    }

    // Admin: how many devices are subscribed.
    case "push_status": {
      if (!isAdmin) return json({ error: "forbidden" }, 403);
      const subs = (await read("push_subs")) || [];
      return json({ count: subs.length });
    }

    // Admin: push a "new episode" (or test) notification to every device.
    // Dead subscriptions (endpoint gone: 404/410) are pruned as we go.
    case "notify": {
      if (!isAdmin) return json({ error: "forbidden" }, 403);
      const subs = (await read("push_subs")) || [];
      if (subs.length === 0) return json({ sent: 0, failed: 0, total: 0 });
      const { publicKey, privateKey } = await getVapid();
      webpush.setVapidDetails(vapidSubject, publicKey, privateKey);
      const siteUrl = (process.env.URL || "/").replace(/\/$/, "") + "/";
      const ep = body.episode || {};
      const payload = JSON.stringify(body.test
        ? { title: "Sunday Sit Downs", body: "Test notification — you're all set! 🎉", url: siteUrl }
        : {
            title: ep.type === "video" ? "New vodcast is up! 🎬" : "New episode is up! 🎙",
            body: String(ep.title ?? "A new Sunday Sit Down is ready.").slice(0, 120),
            url: siteUrl,
          });
      let sent = 0, failed = 0;
      const alive = [];
      for (const sub of subs) {
        try {
          await webpush.sendNotification(sub, payload, { TTL: 60 * 60 * 24 * 3 });
          sent++; alive.push(sub);
        } catch (err) {
          const code = err && err.statusCode;
          failed++;
          if (code !== 404 && code !== 410) alive.push(sub); // keep unless the endpoint is gone
        }
      }
      if (alive.length !== subs.length) await db.set("push_subs", JSON.stringify(alive));
      return json({ sent, failed, total: subs.length });
    }

    default:
      return json({ error: "unknown action" }, 400);
  }
};

export const config = { path: "/api/store" };
