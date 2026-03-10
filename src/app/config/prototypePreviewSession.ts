import type { PrototypePackageFile } from "./projectsSettings";

export const PROTOTYPE_PREVIEW_SCOPE_PREFIX = "/prototype-preview/";
export const PROTOTYPE_PREVIEW_DB_NAME = "portfolio_prototype_preview_v1";
export const PROTOTYPE_PREVIEW_STORE_NAME = "preview_sessions";
const PROTOTYPE_PREVIEW_DB_VERSION = 1;
const PREVIEW_SESSION_TTL = 1000 * 60 * 60 * 6;

export interface PrototypePreviewSessionFile extends PrototypePackageFile {}

export interface PrototypePreviewSession {
  id: string;
  createdAt: number;
  entryPath: string;
  expiresAt: number;
  files: PrototypePreviewSessionFile[];
  projectId?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function isBrowser() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function openDatabase() {
  if (!isBrowser()) {
    throw new Error("IndexedDB is not available in the current environment.");
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(
        PROTOTYPE_PREVIEW_DB_NAME,
        PROTOTYPE_PREVIEW_DB_VERSION,
      );

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PROTOTYPE_PREVIEW_STORE_NAME)) {
          database.createObjectStore(PROTOTYPE_PREVIEW_STORE_NAME, {
            keyPath: "id",
          });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

export function normalizePrototypePreviewPath(path: string) {
  return path
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/{2,}/g, "/")
    .split("/")
    .filter((segment) => segment && segment !== ".")
    .reduce<string[]>((segments, segment) => {
      if (segment === "..") {
        segments.pop();
        return segments;
      }

      segments.push(segment);
      return segments;
    }, [])
    .join("/");
}

export function createPrototypePreviewSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createPrototypePreviewUrl(sessionId: string, entryPath: string) {
  const normalizedEntryPath = normalizePrototypePreviewPath(entryPath);
  const encodedEntryPath = normalizedEntryPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${PROTOTYPE_PREVIEW_SCOPE_PREFIX}${encodeURIComponent(sessionId)}${
    encodedEntryPath ? `/${encodedEntryPath}` : ""
  }`;
}

export async function savePrototypePreviewSession(
  session: Omit<PrototypePreviewSession, "createdAt" | "expiresAt">,
) {
  const database = await openDatabase();
  const transaction = database.transaction(PROTOTYPE_PREVIEW_STORE_NAME, "readwrite");
  const store = transaction.objectStore(PROTOTYPE_PREVIEW_STORE_NAME);
  const now = Date.now();

  store.put({
    ...session,
    createdAt: now,
    entryPath: normalizePrototypePreviewPath(session.entryPath),
    expiresAt: now + PREVIEW_SESSION_TTL,
    files: session.files.map((file) => ({
      ...file,
      path: normalizePrototypePreviewPath(file.path),
    })),
  } satisfies PrototypePreviewSession);

  await transactionToPromise(transaction);
}

export async function deletePrototypePreviewSession(sessionId: string) {
  if (!isBrowser()) return;

  const database = await openDatabase();
  const transaction = database.transaction(PROTOTYPE_PREVIEW_STORE_NAME, "readwrite");
  const store = transaction.objectStore(PROTOTYPE_PREVIEW_STORE_NAME);
  store.delete(sessionId);
  await transactionToPromise(transaction);
}

export async function cleanupExpiredPrototypePreviewSessions() {
  if (!isBrowser()) return;

  const database = await openDatabase();
  const transaction = database.transaction(PROTOTYPE_PREVIEW_STORE_NAME, "readwrite");
  const store = transaction.objectStore(PROTOTYPE_PREVIEW_STORE_NAME);
  const sessions = await requestToPromise<PrototypePreviewSession[]>(store.getAll());
  const now = Date.now();

  sessions
    .filter((session) => session.expiresAt <= now)
    .forEach((session) => store.delete(session.id));

  await transactionToPromise(transaction);
}
