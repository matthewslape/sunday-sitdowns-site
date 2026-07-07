// ─── Storage shim ───────────────────────────────────────────────────────────────
// The app was originally built against a `window.storage` key-value API.
// On a normal website that API doesn't exist, so this shim provides the same
// interface backed by the browser's localStorage.
//
// IMPORTANT LIMITATION: localStorage is per-browser, per-device. Episodes and
// subscribers saved here live only in the browser that saved them — they are
// NOT shared between visitors. Fine for testing and single-admin demos; for a
// real multi-user site, replace this file with calls to a shared backend
// (e.g. Cloudflare Workers KV, Supabase, or Firebase) keeping the same API.

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
