const PREVIEW_SCOPE_PREFIX = "/prototype-preview/";
const PREVIEW_DB_NAME = "portfolio_prototype_preview_v1";
const PREVIEW_DB_VERSION = 1;
const PREVIEW_STORE_NAME = "preview_sessions";
const MEDIA_DB_NAME = "portfolio_media_v1";
const MEDIA_DB_VERSION = 1;
const MEDIA_STORE_NAME = "media_assets";
const MEDIA_REF_PREFIX = "idb:";
const REMOTE_MEDIA_REF_PREFIX = "netlify:";
const SHARED_CONTENT_MEDIA_ENDPOINT = "/.netlify/functions/shared-content-media";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionToPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openDatabase(name, version, upgradeCallback) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);

    request.onupgradeneeded = () => {
      if (upgradeCallback) {
        upgradeCallback(request.result);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function openPreviewDatabase() {
  return openDatabase(PREVIEW_DB_NAME, PREVIEW_DB_VERSION, (database) => {
    if (!database.objectStoreNames.contains(PREVIEW_STORE_NAME)) {
      database.createObjectStore(PREVIEW_STORE_NAME, {
        keyPath: "id",
      });
    }
  });
}

async function openMediaDatabase() {
  return openDatabase(MEDIA_DB_NAME, MEDIA_DB_VERSION);
}

function normalizePath(path) {
  return path
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/{2,}/g, "/")
    .split("/")
    .filter((segment) => segment && segment !== ".")
    .reduce((segments, segment) => {
      if (segment === "..") {
        segments.pop();
        return segments;
      }

      segments.push(segment);
      return segments;
    }, [])
    .join("/");
}

function decodePathSegments(segments) {
  return segments.map((segment) => decodeURIComponent(segment)).join("/");
}

function splitPreviewPath(pathname) {
  if (!pathname.startsWith(PREVIEW_SCOPE_PREFIX)) return null;

  const segments = pathname
    .slice(PREVIEW_SCOPE_PREFIX.length)
    .split("/")
    .filter(Boolean);

  if (segments.length === 0) return null;

  const [sessionId, ...packageSegments] = segments;
  return {
    packagePath: normalizePath(decodePathSegments(packageSegments)),
    sessionId: decodeURIComponent(sessionId),
  };
}

function encodePreviewPath(sessionId, filePath) {
  const encodedPath = normalizePath(filePath)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${PREVIEW_SCOPE_PREFIX}${encodeURIComponent(sessionId)}${
    encodedPath ? `/${encodedPath}` : ""
  }`;
}

async function getPreviewSession(sessionId) {
  const database = await openPreviewDatabase();
  const transaction = database.transaction(PREVIEW_STORE_NAME, "readonly");
  const store = transaction.objectStore(PREVIEW_STORE_NAME);
  const session = await requestToPromise(store.get(sessionId));
  await transactionToPromise(transaction);
  return session || null;
}

function guessMimeType(path) {
  const normalizedPath = path.toLowerCase();

  if (normalizedPath.endsWith(".html") || normalizedPath.endsWith(".htm")) {
    return "text/html; charset=utf-8";
  }
  if (normalizedPath.endsWith(".css")) return "text/css; charset=utf-8";
  if (normalizedPath.endsWith(".js") || normalizedPath.endsWith(".mjs")) {
    return "text/javascript; charset=utf-8";
  }
  if (normalizedPath.endsWith(".json")) return "application/json; charset=utf-8";
  if (normalizedPath.endsWith(".svg")) return "image/svg+xml";
  if (normalizedPath.endsWith(".png")) return "image/png";
  if (normalizedPath.endsWith(".jpg") || normalizedPath.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (normalizedPath.endsWith(".gif")) return "image/gif";
  if (normalizedPath.endsWith(".webp")) return "image/webp";
  if (normalizedPath.endsWith(".ico")) return "image/x-icon";
  if (normalizedPath.endsWith(".bmp")) return "image/bmp";
  if (normalizedPath.endsWith(".pdf")) return "application/pdf";
  if (normalizedPath.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (normalizedPath.endsWith(".csv")) return "text/csv; charset=utf-8";
  if (normalizedPath.endsWith(".xml")) return "application/xml; charset=utf-8";
  if (normalizedPath.endsWith(".wasm")) return "application/wasm";
  if (normalizedPath.endsWith(".woff")) return "font/woff";
  if (normalizedPath.endsWith(".woff2")) return "font/woff2";
  if (normalizedPath.endsWith(".ttf")) return "font/ttf";
  if (normalizedPath.endsWith(".otf")) return "font/otf";
  if (normalizedPath.endsWith(".mp4")) return "video/mp4";
  if (normalizedPath.endsWith(".webm")) return "video/webm";
  if (normalizedPath.endsWith(".ogg")) return "video/ogg";
  if (normalizedPath.endsWith(".mp3")) return "audio/mpeg";
  if (normalizedPath.endsWith(".wav")) return "audio/wav";
  if (normalizedPath.endsWith(".map")) return "application/json; charset=utf-8";

  return "application/octet-stream";
}

function resolveSessionFile(session, requestPath, requestMode) {
  const normalizedRequestPath = normalizePath(requestPath);
  const normalizedEntryPath = normalizePath(session.entryPath || "index.html");
  const files = Array.isArray(session.files) ? session.files : [];
  const fileMap = new Map(
    files.map((file) => [normalizePath(file.path), file]),
  );
  const candidatePaths = [];

  if (!normalizedRequestPath) {
    candidatePaths.push(normalizedEntryPath, "index.html");
  } else {
    candidatePaths.push(normalizedRequestPath);

    if (normalizedRequestPath.endsWith("/")) {
      candidatePaths.push(`${normalizedRequestPath}index.html`);
    }

    if (!/\.[a-z0-9]+$/i.test(normalizedRequestPath)) {
      candidatePaths.push(`${normalizedRequestPath}.html`);
      candidatePaths.push(`${normalizedRequestPath}/index.html`);
    }
  }

  if (requestMode === "navigate") {
    candidatePaths.push(normalizedEntryPath);
  }

  const uniqueCandidatePaths = Array.from(new Set(candidatePaths));
  for (const candidatePath of uniqueCandidatePaths) {
    const matchedFile = fileMap.get(candidatePath);
    if (matchedFile) {
      return {
        file: matchedFile,
        resolvedPath: candidatePath,
      };
    }
  }

  return null;
}

async function resolveMediaBlob(src) {
  if (!src) return null;

  if (src.startsWith(REMOTE_MEDIA_REF_PREFIX)) {
    const params = new URLSearchParams(src.slice(REMOTE_MEDIA_REF_PREFIX.length));
    const key = params.get("key");

    if (!key) return null;

    const response = await fetch(
      `${SHARED_CONTENT_MEDIA_ENDPOINT}?${new URLSearchParams({
        key,
      }).toString()}`,
    );

    if (!response.ok) return null;
    return response.blob();
  }

  if (!src.startsWith(MEDIA_REF_PREFIX)) {
    const response = await fetch(src);
    if (!response.ok) return null;
    return response.blob();
  }

  const mediaId = src.slice(MEDIA_REF_PREFIX.length);
  const database = await openMediaDatabase();
  const transaction = database.transaction(MEDIA_STORE_NAME, "readonly");
  const store = transaction.objectStore(MEDIA_STORE_NAME);
  const record = await requestToPromise(store.get(mediaId));
  await transactionToPromise(transaction);
  return record ? record.blob : null;
}

async function createFileResponse(file, resolvedPath) {
  const blob = await resolveMediaBlob(file.src);
  if (!blob) return null;

  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": file.mimeType || blob.type || guessMimeType(resolvedPath),
  });

  return new Response(blob, {
    headers,
    status: 200,
  });
}

function createNotFoundResponse() {
  return new Response("Prototype preview file not found.", {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
    status: 404,
  });
}

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const directPreviewContext = splitPreviewPath(requestUrl.pathname);
  const referrerUrl = event.request.referrer
    ? new URL(event.request.referrer)
    : null;
  const referrerPreviewContext = !directPreviewContext && referrerUrl
    ? splitPreviewPath(referrerUrl.pathname)
    : null;

  if (!directPreviewContext && !referrerPreviewContext) return;

  event.respondWith((async () => {
    const previewContext = directPreviewContext || referrerPreviewContext;
    const session = await getPreviewSession(previewContext.sessionId);

    if (!session || session.expiresAt <= Date.now()) {
      return createNotFoundResponse();
    }

    const requestPath = directPreviewContext
      ? previewContext.packagePath
      : normalizePath(requestUrl.pathname.replace(/^\/+/, ""));
    const matchedSessionFile = resolveSessionFile(
      session,
      requestPath,
      event.request.mode,
    );

    if (!matchedSessionFile) {
      if (directPreviewContext) {
        return createNotFoundResponse();
      }

      return fetch(event.request);
    }

    if (
      !directPreviewContext &&
      event.request.mode === "navigate"
    ) {
      return Response.redirect(
        encodePreviewPath(
          previewContext.sessionId,
          matchedSessionFile.resolvedPath,
        ),
        302,
      );
    }

    const response = await createFileResponse(
      matchedSessionFile.file,
      matchedSessionFile.resolvedPath,
    );
    return response || createNotFoundResponse();
  })());
});
