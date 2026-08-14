// Store-and-forward outbox for the background write stream (audit, auto
// decisions, tasking). Writes are buffered in IndexedDB with a client request
// id and reconciled idempotently: a replayed flush never creates a duplicate
// audit entry or tasking order. While comms are simulated-down the queue holds;
// when comms return the queue drains.
//
// Interactive calls (decision resolution) bypass the outbox — the operator
// needs an immediate answer — but they record their own audit entry, which
// itself flows through here.

import { writeAudit, recordAutoDecision, recordTasking } from "./ops.functions";

type OutboxType = "audit" | "auto-decision" | "tasking";

type OutboxItem = {
  id: string; // client request id → idempotency key
  type: OutboxType;
  data: Record<string, unknown>;
  ts: number;
  attempts: number;
  lastError?: string;
};

export type OutboxSnapshot = {
  pending: number;
  flushing: boolean;
  online: boolean;
  lastError: string | null;
};

const DB_NAME = "vigilance";
const STORE = "outbox";
const FLUSH_INTERVAL_MS = 8_000;

let dbReady: Promise<IDBDatabase> | null = null;
let reachability: () => boolean = () => true;
let flushing = false;
let lastError: string | null = null;
const subscribers = new Set<(s: OutboxSnapshot) => void>();

function snapshot(): OutboxSnapshot {
  return { pending: -1, flushing, online: reachability(), lastError };
}

function notify(pending: number) {
  const s: OutboxSnapshot = { pending, flushing, online: reachability(), lastError };
  subscribers.forEach((fn) => fn(s));
}

export function subscribeOutbox(fn: (s: OutboxSnapshot) => void): () => void {
  subscribers.add(fn);
  // fire once immediately with the current count
  void countPending().then((n) => fn({ pending: n, flushing, online: reachability(), lastError }));
  return () => subscribers.delete(fn);
}

export function setReachabilityChecker(fn: () => boolean) {
  reachability = fn;
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("no indexeddb"));
  if (dbReady) return dbReady;
  dbReady = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbReady;
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putItem(item: OutboxItem) {
  await tx("readwrite", (s) => s.put(item));
}
async function deleteItem(id: string) {
  await tx("readwrite", (s) => s.delete(id));
}
async function allItems(): Promise<OutboxItem[]> {
  return tx<OutboxItem[]>("readonly", (s) => s.getAll() as IDBRequest<OutboxItem[]>);
}
async function countPending(): Promise<number> {
  try {
    return tx<number>("readonly", (s) => s.count() as IDBRequest<number>);
  } catch {
    return 0;
  }
}

function newId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Enqueue an audit write. Returns the idempotency key. */
export async function enqueueAudit(
  kind: string,
  payload: Record<string, unknown>,
  mode: "TRAINING" | "LIVE",
  classification = "RESTRICTED",
): Promise<string> {
  const id = newId();
  await putItem({ id, type: "audit", data: { kind, payload, mode, classification, idempotencyKey: id }, ts: Date.now(), attempts: 0 });
  void flushOutbox();
  return id;
}

/** Enqueue an auto-decision record (idempotent on event_id). */
export async function enqueueAutoDecision(data: Record<string, unknown>): Promise<void> {
  const id = String(data.eventId ?? newId());
  await putItem({ id, type: "auto-decision", data: { ...data, idempotencyKey: id }, ts: Date.now(), attempts: 0 });
  void flushOutbox();
}

/** Enqueue a tasking order (idempotent on client_request_id). */
export async function enqueueTasking(data: Record<string, unknown>): Promise<string> {
  const id = String(data.clientRequestId ?? newId());
  await putItem({ id, type: "tasking", data: { ...data, clientRequestId: id }, ts: Date.now(), attempts: 0 });
  void flushOutbox();
  return id;
}

async function sendOne(item: OutboxItem): Promise<boolean> {
  try {
    if (item.type === "audit") {
      await writeAudit({ data: item.data as never });
    } else if (item.type === "auto-decision") {
      await recordAutoDecision({ data: item.data as never });
    } else {
      await recordTasking({ data: item.data as never });
    }
    return true;
  } catch (e) {
    item.lastError = e instanceof Error ? e.message : String(e);
    item.attempts += 1;
    await putItem(item); // keep for next flush
    return false;
  }
}

/** Drain the queue. Safe to call repeatedly. Holds while comms are simulated-down. */
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  if (!reachability()) {
    lastError = null;
    void countPending().then(notify);
    return;
  }
  flushing = true;
  void countPending().then((n) => notify(n));
  try {
    const items = await allItems();
    for (const item of items) {
      const ok = await sendOne(item);
      if (ok) await deleteItem(item.id);
    }
    lastError = null;
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
  } finally {
    flushing = false;
    void countPending().then(notify);
  }
}

/** Start the background flush ticker. Call once on the client. */
export function startOutboxTicker() {
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => void flushOutbox());
  setInterval(() => void flushOutbox(), FLUSH_INTERVAL_MS);
  void flushOutbox();
}
