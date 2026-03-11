import { getImageSettingsAccessPassword } from "./imageSettingsAccess";
import {
  SHARED_CONTENT_MEDIA_ENDPOINT,
  createRemoteMediaReference,
  createSharedContentAuthHeaders,
  buildRemoteMediaUrl,
  hasSharedContentServiceHeader,
  isRemoteMediaReference,
  parseRemoteMediaReference,
} from "./sharedContentEndpoints";

const DB_NAME = "portfolio_media_v1";
const STORE_NAME = "media_assets";
const MEDIA_REF_PREFIX = "idb:";
const REMOTE_MEDIA_CHUNK_SIZE = 3 * 1024 * 1024;
const REMOTE_MEDIA_RETRY_DELAYS = [250, 800, 1600];
const REMOTE_MEDIA_RESOLVE_BATCH_LIMIT = 200;

interface MediaRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;
const objectUrlCache = new Map<string, string>();
const mimeTypeCache = new Map<string, string>();
const pendingLoads = new Map<string, Promise<string | null>>();
const remoteResolvedUrlCache = new Map<string, string>();

function isBrowser() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function createMediaId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

function parseLocalMediaRef(src: string) {
  const normalizedSrc = src.trim();
  return normalizedSrc.startsWith(MEDIA_REF_PREFIX)
    ? normalizedSrc.slice(MEDIA_REF_PREFIX.length)
    : null;
}

function cacheMediaRecord(id: string, blob: Blob, mimeType: string) {
  const nextObjectUrl = URL.createObjectURL(blob);
  const previousObjectUrl = objectUrlCache.get(id);

  if (previousObjectUrl && previousObjectUrl !== nextObjectUrl) {
    URL.revokeObjectURL(previousObjectUrl);
  }

  objectUrlCache.set(id, nextObjectUrl);
  mimeTypeCache.set(id, mimeType);
  return nextObjectUrl;
}

async function loadMediaRecord(id: string) {
  if (!isBrowser()) return null;

  const cachedObjectUrl = objectUrlCache.get(id);
  if (cachedObjectUrl) return cachedObjectUrl;

  const pendingLoad = pendingLoads.get(id);
  if (pendingLoad) return pendingLoad;

  const request = (async () => {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const record = await requestToPromise<MediaRecord | undefined>(store.get(id));
    await transactionToPromise(transaction);

    if (!record) return null;
    return cacheMediaRecord(id, record.blob, record.mimeType);
  })().finally(() => {
    pendingLoads.delete(id);
  });

  pendingLoads.set(id, request);
  return request;
}

async function getStoredMediaRecord(src: string | null | undefined) {
  const mediaId = src ? parseLocalMediaRef(src) : null;
  if (!mediaId || !isBrowser()) return null;

  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readonly");
  const store = transaction.objectStore(STORE_NAME);
  const record = await requestToPromise<MediaRecord | undefined>(store.get(mediaId));
  await transactionToPromise(transaction);
  return record ?? null;
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const [, base64 = ""] = result.split(",", 2);
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function wait(duration: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

async function readErrorResponse(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function fetchRemoteMediaWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= REMOTE_MEDIA_RETRY_DELAYS.length; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (response.ok || response.status === 401 || response.status < 500) {
        return response;
      }

      const errorText = await readErrorResponse(response);
      lastError = new Error(
        `REMOTE_MEDIA_HTTP_${response.status}${errorText ? `:${errorText}` : ""}`,
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("REMOTE_MEDIA_FETCH_FAILED");
    }

    if (attempt < REMOTE_MEDIA_RETRY_DELAYS.length) {
      await wait(REMOTE_MEDIA_RETRY_DELAYS[attempt]);
    }
  }

  throw lastError || new Error("REMOTE_MEDIA_FETCH_FAILED");
}

export function isStoredMediaReference(src: string | null | undefined): src is string {
  return Boolean(
    src && (parseLocalMediaRef(src) || parseRemoteMediaReference(src)),
  );
}

export function resolveStoredMediaSrc(src: string | null | undefined) {
  if (!src || !src.trim()) return null;

  const remoteReference = parseRemoteMediaReference(src);
  if (remoteReference) {
    return remoteResolvedUrlCache.get(src) || buildRemoteMediaUrl(remoteReference.key);
  }

  const mediaId = parseLocalMediaRef(src);
  if (!mediaId) return src.trim();

  const cachedObjectUrl = objectUrlCache.get(mediaId);
  if (cachedObjectUrl) return cachedObjectUrl;

  void loadMediaRecord(mediaId);
  return null;
}

export function getStoredMediaMimeType(src: string | null | undefined) {
  if (!src || !src.trim()) return null;

  const remoteReference = parseRemoteMediaReference(src);
  if (remoteReference) {
    return remoteReference.mimeType ?? null;
  }

  const mediaId = parseLocalMediaRef(src);
  if (!mediaId) return null;

  return mimeTypeCache.get(mediaId) ?? null;
}

export async function loadStoredMediaBlob(src: string | null | undefined) {
  if (!src || !src.trim()) return null;

  const remoteReference = parseRemoteMediaReference(src);
  if (remoteReference) {
    const directUrl = remoteResolvedUrlCache.get(src);
    let response = await fetch(directUrl || buildRemoteMediaUrl(remoteReference.key), {
      cache: "force-cache",
    });

    if (!response.ok && directUrl) {
      remoteResolvedUrlCache.delete(src);
      response = await fetch(buildRemoteMediaUrl(remoteReference.key), {
        cache: "force-cache",
      });
    }

    if (!response.ok) {
      return null;
    }

    return response.blob();
  }

  if (!isStoredMediaReference(src)) {
    const response = await fetch(src);
    return response.blob();
  }

  const record = await getStoredMediaRecord(src);
  return record?.blob ?? null;
}

export async function storeMediaBlob(blob: Blob) {
  const database = await openDatabase();
  const mediaId = createMediaId();
  const mimeType = blob.type || "application/octet-stream";
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);

  store.put({
    id: mediaId,
    blob,
    mimeType,
    updatedAt: Date.now(),
  } satisfies MediaRecord);

  await transactionToPromise(transaction);
  cacheMediaRecord(mediaId, blob, mimeType);
  return `${MEDIA_REF_PREFIX}${mediaId}`;
}

async function uploadRemoteMediaFile(file: File) {
  const password = getImageSettingsAccessPassword();
  if (!password) {
    return null;
  }

  const response = await fetchRemoteMediaWithRetry(SHARED_CONTENT_MEDIA_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
      ...createSharedContentAuthHeaders(password),
    },
    body: file,
  });

  const hasServiceHeader = hasSharedContentServiceHeader(response.headers);
  if (!hasServiceHeader) {
    return null;
  }

  if (response.status === 401) {
    throw new Error("REMOTE_MEDIA_UNAUTHORIZED");
  }

  if (!response.ok) {
    throw new Error(
      `REMOTE_MEDIA_UPLOAD_FAILED:${response.status}:${await readErrorResponse(response)}`,
    );
  }

  const payload = (await response.json()) as {
    key?: string;
    mimeType?: string;
  };

  if (!payload.key) {
    throw new Error("REMOTE_MEDIA_MALFORMED_RESPONSE");
  }

  return createRemoteMediaReference(payload.key, payload.mimeType || file.type);
}

async function uploadRemoteMediaFileInChunks(file: File) {
  const password = getImageSettingsAccessPassword();
  if (!password) {
    return null;
  }

  const uploadId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const mimeType = file.type || "application/octet-stream";
  const totalChunks = Math.ceil(file.size / REMOTE_MEDIA_CHUNK_SIZE);

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const chunkBlob = file.slice(
      chunkIndex * REMOTE_MEDIA_CHUNK_SIZE,
      (chunkIndex + 1) * REMOTE_MEDIA_CHUNK_SIZE,
      mimeType,
    );
    const chunkBase64 = await blobToBase64(chunkBlob);
    const response = await fetchRemoteMediaWithRetry(SHARED_CONTENT_MEDIA_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...createSharedContentAuthHeaders(password),
      },
      body: JSON.stringify({
        chunkBase64,
        fileName: file.name,
        index: chunkIndex,
        mimeType,
        mode: "chunk",
        totalChunks,
        uploadId,
      }),
    });

    const hasServiceHeader = hasSharedContentServiceHeader(response.headers);
    if (!hasServiceHeader) {
      return null;
    }

    if (response.status === 401) {
      throw new Error("REMOTE_MEDIA_UNAUTHORIZED");
    }

    if (!response.ok) {
      throw new Error(
        `REMOTE_MEDIA_CHUNK_UPLOAD_FAILED:${response.status}:${await readErrorResponse(response)}`,
      );
    }
  }

  const completeResponse = await fetchRemoteMediaWithRetry(SHARED_CONTENT_MEDIA_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...createSharedContentAuthHeaders(password),
    },
    body: JSON.stringify({
      fileName: file.name,
      mimeType,
      mode: "complete",
      totalChunks,
      uploadId,
    }),
  });

  const hasServiceHeader = hasSharedContentServiceHeader(completeResponse.headers);
  if (!hasServiceHeader) {
    return null;
  }

  if (completeResponse.status === 401) {
    throw new Error("REMOTE_MEDIA_UNAUTHORIZED");
  }

  if (!completeResponse.ok) {
    throw new Error(
      `REMOTE_MEDIA_COMPLETE_FAILED:${completeResponse.status}:${await readErrorResponse(completeResponse)}`,
    );
  }

  const payload = (await completeResponse.json()) as {
    key?: string;
    mimeType?: string;
  };

  if (!payload.key) {
    throw new Error("REMOTE_MEDIA_MALFORMED_RESPONSE");
  }

  return createRemoteMediaReference(payload.key, payload.mimeType || mimeType);
}

export async function storeMediaFile(file: File) {
  if (file.size > REMOTE_MEDIA_CHUNK_SIZE) {
    const remoteChunkedReference = await uploadRemoteMediaFileInChunks(file);
    if (remoteChunkedReference) {
      return remoteChunkedReference;
    }
  }

  const remoteReference = await uploadRemoteMediaFile(file);
  if (remoteReference) {
    return remoteReference;
  }

  return storeMediaBlob(file);
}

export async function resolveRemoteMediaPreviewUrls(
  sources: Array<string | null | undefined>,
) {
  const remoteEntries = Array.from(
    new Set(
      sources
        .filter((source): source is string => Boolean(source))
        .map((source) => source.trim())
        .filter((source) => Boolean(parseRemoteMediaReference(source))),
    ),
  );

  if (remoteEntries.length === 0) {
    return new Map<string, string>();
  }

  const keyToSources = new Map<string, string[]>();
  const unresolvedKeys: string[] = [];

  for (const source of remoteEntries) {
    const remoteReference = parseRemoteMediaReference(source);
    if (!remoteReference) continue;

    const cachedUrl = remoteResolvedUrlCache.get(source);
    if (cachedUrl) continue;

    const currentSources = keyToSources.get(remoteReference.key) ?? [];
    currentSources.push(source);
    keyToSources.set(remoteReference.key, currentSources);
  }

  unresolvedKeys.push(...keyToSources.keys());
  if (unresolvedKeys.length > 0) {
    for (let index = 0; index < unresolvedKeys.length; index += REMOTE_MEDIA_RESOLVE_BATCH_LIMIT) {
      const keys = unresolvedKeys.slice(index, index + REMOTE_MEDIA_RESOLVE_BATCH_LIMIT);
      const response = await fetchRemoteMediaWithRetry(SHARED_CONTENT_MEDIA_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keys,
          mode: "resolve-batch",
        }),
      });

      const hasServiceHeader = hasSharedContentServiceHeader(response.headers);
      if (!hasServiceHeader || !response.ok) {
        continue;
      }

      const payload = (await response.json()) as {
        items?: Array<{ key?: string; url?: string }>;
      };

      for (const item of payload.items ?? []) {
        if (
          !item ||
          typeof item.key !== "string" ||
          !item.key.trim() ||
          typeof item.url !== "string" ||
          !item.url.trim()
        ) {
          continue;
        }

        for (const source of keyToSources.get(item.key) ?? []) {
          remoteResolvedUrlCache.set(source, item.url.trim());
        }
      }
    }
  }

  return new Map(
    remoteEntries
      .map((source) => [source, remoteResolvedUrlCache.get(source)] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

export async function migrateDataUrlToStoredMedia(src: string) {
  const blob = await dataUrlToBlob(src);
  return storeMediaBlob(blob);
}

export async function warmStoredMediaRefs(refs: string[]) {
  const uniqueIds = Array.from(
    new Set(
      refs
        .map((ref) => parseLocalMediaRef(ref))
        .filter((mediaId): mediaId is string => Boolean(mediaId)),
    ),
  );

  await Promise.all(uniqueIds.map((mediaId) => loadMediaRecord(mediaId)));
}

export async function deleteStoredMedia(src: string | null | undefined) {
  const remoteReference = src ? parseRemoteMediaReference(src) : null;
  if (remoteReference) {
    remoteResolvedUrlCache.delete(src);
    const password = getImageSettingsAccessPassword();
    if (!password) return;

    const response = await fetch(
      `${SHARED_CONTENT_MEDIA_ENDPOINT}?${new URLSearchParams({
        key: remoteReference.key,
      }).toString()}`,
      {
        method: "DELETE",
        headers: createSharedContentAuthHeaders(password),
      },
    );

    if (response.status === 401) {
      throw new Error("REMOTE_MEDIA_UNAUTHORIZED");
    }

    return;
  }

  const mediaId = src ? parseLocalMediaRef(src) : null;
  if (!mediaId) return;

  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);

  store.delete(mediaId);
  await transactionToPromise(transaction);

  const cachedObjectUrl = objectUrlCache.get(mediaId);
  if (cachedObjectUrl) {
    URL.revokeObjectURL(cachedObjectUrl);
    objectUrlCache.delete(mediaId);
  }

  mimeTypeCache.delete(mediaId);
  pendingLoads.delete(mediaId);
}

export async function deleteStoredMediaBatch(
  sources: Array<string | null | undefined>,
) {
  await Promise.all(sources.map((source) => deleteStoredMedia(source)));
}

export { isRemoteMediaReference };
