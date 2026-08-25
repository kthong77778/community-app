import { DEFAULT_DB_PATH, JsonStore } from "./json-store";
import type { Store } from "./Store";

// Single shared Store instance for the process.
//
// We stash it on globalThis so that Next.js hot-reloading in development does
// not create a new store (and a new write queue) on every module reload.
//
// ---------------------------------------------------------------------------
// Swapping to a real database later:
//   1. Write a class that implements `Store` (e.g. PostgresStore) in this dir.
//   2. Change the line below to instantiate it.
// Nothing else in the app imports the concrete store — only `getStore()`.
// ---------------------------------------------------------------------------
const globalForStore = globalThis as unknown as { __store?: Store };

export function getStore(): Store {
  if (!globalForStore.__store) {
    globalForStore.__store = new JsonStore(DEFAULT_DB_PATH);
  }
  return globalForStore.__store;
}

export type { Store } from "./Store";
