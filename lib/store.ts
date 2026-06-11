/**
 * Minimal document store used for persisting review decisions, opportunity
 * history, and diagnostics snapshots (Steps 3 & 5).
 *
 * Adapter is chosen at runtime:
 *   1. Redis (Upstash / Vercel KV REST) when KV_REST_API_URL + KV_REST_API_TOKEN
 *      (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN) are set.  ← Vercel
 *   2. File store (DATA_DIR, or /tmp on Vercel, or ./.data locally).
 *   3. In-memory (process-local; resets between serverless invocations).
 *
 * Durable persistence on Vercel REQUIRES the Redis/KV option — the filesystem
 * is ephemeral and in-memory does not survive cold starts.
 */

export type StoreKind = "redis" | "file" | "memory";

export interface DocStore {
  kind: StoreKind;
  getJSON<T>(key: string): Promise<T | null>;
  setJSON<T>(key: string, value: T): Promise<void>;
}

// ── In-memory ─────────────────────────────────────────────────────────────
const memory = new Map<string, string>();

function memoryStore(): DocStore {
  return {
    kind: "memory",
    async getJSON<T>(key: string) {
      const raw = memory.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    },
    async setJSON<T>(key: string, value: T) {
      memory.set(key, JSON.stringify(value));
    },
  };
}

// ── Redis (Upstash / Vercel KV REST) ───────────────────────────────────────
function redisStore(url: string, token: string): DocStore {
  async function command(args: (string | number)[]): Promise<unknown> {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`KV ${args[0]} failed: ${res.status}`);
    const data = (await res.json()) as { result?: unknown };
    return data.result;
  }

  return {
    kind: "redis",
    async getJSON<T>(key: string) {
      const result = await command(["GET", key]);
      return typeof result === "string" ? (JSON.parse(result) as T) : null;
    },
    async setJSON<T>(key: string, value: T) {
      await command(["SET", key, JSON.stringify(value)]);
    },
  };
}

// ── File (local / ephemeral) ────────────────────────────────────────────────
function fileStore(dir: string): DocStore {
  const path = (key: string) => `${dir}/${key.replace(/[^a-z0-9_-]/gi, "_")}.json`;
  return {
    kind: "file",
    async getJSON<T>(key: string) {
      const fs = await import("node:fs/promises");
      try {
        const raw = await fs.readFile(path(key), "utf8");
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    async setJSON<T>(key: string, value: T) {
      const fs = await import("node:fs/promises");
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path(key), JSON.stringify(value), "utf8");
    },
  };
}

let cached: DocStore | null = null;

export function getStore(): DocStore {
  if (cached) return cached;

  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    cached = redisStore(url, token);
    return cached;
  }

  try {
    const dir =
      process.env.DATA_DIR ?? (process.env.VERCEL ? "/tmp/arb-data" : "./.data");
    cached = fileStore(dir);
    return cached;
  } catch {
    cached = memoryStore();
    return cached;
  }
}

/** Storage keys. */
export const KEYS = {
  reviews: "reviews",
  history: "history",
  analytics: "analytics_snapshots",
} as const;
