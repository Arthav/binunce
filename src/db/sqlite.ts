import initSqlJs from "sql.js";
import type { Database } from "sql.js";
import { deleteKey, getBytes, setBytes } from "./idb";
import { DB_KEY, runMigrations } from "./schema";
import { MemoryRepo, SqliteRepo, type BinunceRepo } from "./repo";

export interface RepoRuntime {
  repo: BinunceRepo;
  storageWarning: string | null;
  flush: () => Promise<void>;
}

export async function createRepoRuntime(): Promise<RepoRuntime> {
  try {
    const SQL = await initSqlJs({
      locateFile: (file) => `/${file}`,
    });

    let bytes = await getBytes(DB_KEY);
    let db: Database;
    let storageWarning: string | null = null;

    try {
      db = bytes ? new SQL.Database(bytes) : new SQL.Database();
      runMigrations(db);
    } catch {
      if (bytes) {
        await setBytes(`${DB_KEY}_corrupt_${Date.now()}`, bytes);
      }
      await deleteKey(DB_KEY);
      db = new SQL.Database();
      runMigrations(db);
      storageWarning = "Save reset after a corrupted local database was detected.";
      bytes = null;
    }

    let dirty = !bytes;
    let timer = 0;
    let writeQueue = Promise.resolve();

    const flush = async () => {
      if (!dirty) return;
      dirty = false;
      const exported = db.export();
      writeQueue = writeQueue.then(() => setBytes(DB_KEY, exported));
      await writeQueue;
    };

    const markDirty = () => {
      dirty = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void flush();
      }, 750);
    };

    const repo = new SqliteRepo(db, markDirty);
    await flush();

    return {
      repo,
      storageWarning,
      flush,
    };
  } catch (error) {
    console.error(error);
    return {
      repo: new MemoryRepo(),
      storageWarning: "Storage unavailable - progress will not be saved this session.",
      flush: async () => undefined,
    };
  }
}
