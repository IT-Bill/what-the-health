import type { ParsedRecord, HealthSource } from "./types";

interface CacheEntry {
  records: ParsedRecord[];
  source: HealthSource;
  userId: string;
  createdAt: number;
}

/** In-memory cache for parsed health data awaiting user confirmation. */
const cache = new Map<string, CacheEntry>();

/** TTL in ms (10 minutes). */
const TTL = 10 * 60 * 1000;

/** Generate a simple unique ID. */
function generateId(): string {
  return `preview_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Store parsed records and return a preview ID. */
export function storePreview(records: ParsedRecord[], source: HealthSource, userId: string): string {
  cleanup();
  const id = generateId();
  cache.set(id, { records, source, userId, createdAt: Date.now() });
  return id;
}

/** Retrieve cached records. Returns null if expired or not found. */
export function getPreview(previewId: string, userId: string): CacheEntry | null {
  cleanup();
  const entry = cache.get(previewId);
  if (!entry) return null;
  if (entry.userId !== userId) return null;
  return entry;
}

/** Remove a preview from cache (after confirm or cancel). */
export function deletePreview(previewId: string): void {
  cache.delete(previewId);
}

/** Remove expired entries. */
function cleanup(): void {
  const now = Date.now();
  for (const [id, entry] of cache) {
    if (now - entry.createdAt > TTL) {
      cache.delete(id);
    }
  }
}
