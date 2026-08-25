import { DEFAULT_DB_PATH, SqliteStore } from "./sqlite-store";
import type { Store } from "./Store";

// Single shared Store instance for the process.
//
// Stashed on globalThis so Next.js hot-reloading in development does not open a
// new database connection on every module reload.
//
// ---------------------------------------------------------------------------
// Swapping databases later:
//   1. Write a class that implements `Store` (e.g. PostgresStore) in this dir.
//   2. Change the line below to instantiate it (e.g. based on DATABASE_URL).
// Nothing else in the app imports the concrete store — only `getStore()`.
// ---------------------------------------------------------------------------
const globalForStore = globalThis as unknown as { __store?: Store };

export function getStore(): Store {
  if (!globalForStore.__store) {
    const path = process.env.SQLITE_PATH || DEFAULT_DB_PATH;
    globalForStore.__store = new SqliteStore(path);
  }
  return globalForStore.__store;
}

export type { Store } from "./Store";
