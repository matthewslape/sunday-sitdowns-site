// ─── Storage shim ───────────────────────────────────────────────────────────────
// The app was originally built against a `window.storage` key-value API.
// On a normal website that API doesn't exist, so this shim provides the same
// interface backed by the browser's localStorage.
//
// NOTE: This shim is now the FALLBACK only. In production the app talks to
// the shared backend at /api/store (netlify/functions/store.mjs, backed by
// Netlify Blobs), so data is shared across all visitors and devices. This
// localStorage version kicks in only when that API is unreachable — e.g.
// plain `vite` dev without Netlify — keeping single-device demos working.

const PREFIX = "ssd:";

const storage = {
  async get(key /*, shared */) {
    const value = localStorage.getItem(PREFIX + key);
    return value === null ? null : { key, value };
  },
  async set(key, value /*, shared */) {
    localStorage.setItem(PREFIX + key, String(value));
    return { key, value };
  },
  async delete(key /*, shared */) {
    localStorage.removeItem(PREFIX + key);
    return { key, deleted: true };
  },
  async list(prefix = "" /*, shared */) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX + prefix)) keys.push(k.slice(PREFIX.length));
    }
    return { keys, prefix };
  },
};

if (typeof window !== "undefined" && !window.storage) {
  window.storage = storage;
}

export default storage;
