import {
  badRequestResponse,
  buildServiceHeaders,
  createMediaKey,
  emptyResponse,
  isAuthorized,
  jsonResponse,
  mediaStore,
  methodNotAllowedResponse,
  unauthorizedResponse,
} from "./_shared/portfolio-shared.mjs";

const DEFAULT_NETLIFY_API_URL = "https://api.netlify.com";
const SIGNED_URL_ACCEPT_HEADER = "application/json;type=signed-url";
const MEDIA_STORE_NAME = "site:portfolio-shared-media";

function getRequestKey(request) {
  return new URL(request.url).searchParams.get("key")?.trim() || "";
}

function getChunkKey(uploadId, chunkIndex) {
  return `multipart/${uploadId}/${chunkIndex}`;
}

const MEDIA_STORE_RETRY_DELAYS = [250, 800, 1600];

function wait(duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration);
  });
}

function getBlobsEnvironmentContext() {
  const encodedContext =
    globalThis.netlifyBlobsContext || process.env.NETLIFY_BLOBS_CONTEXT;

  if (typeof encodedContext !== "string" || !encodedContext.trim()) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encodedContext, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

async function getMediaSignedUrl(key) {
  const context = getBlobsEnvironmentContext();
  const apiUrl =
    context?.apiURL ||
    process.env.NETLIFY_BLOBS_API_URL ||
    DEFAULT_NETLIFY_API_URL;
  const siteId =
    context?.siteID ||
    process.env.SITE_ID ||
    process.env.NETLIFY_SITE_ID ||
    "";
  const token = context?.token || process.env.NETLIFY_AUTH_TOKEN || "";

  if (!siteId || !token) {
    return null;
  }

  const signedUrlResponse = await fetch(
    `${apiUrl}/api/v1/blobs/${encodeURIComponent(siteId)}/${MEDIA_STORE_NAME}/${key
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")}`,
    {
      headers: {
        Accept: SIGNED_URL_ACCEPT_HEADER,
        Authorization: `Bearer ${token}`,
      },
      method: "GET",
    },
  );

  if (!signedUrlResponse.ok) {
    const errorText = await signedUrlResponse.text();
    console.error(
      `[shared-content-media] signed url request failed: key="${key}" status=${signedUrlResponse.status} body="${errorText}"`,
    );
    return null;
  }

  const payload = await signedUrlResponse.json();
  if (!payload?.url || typeof payload.url !== "string") {
    return null;
  }

  return payload.url;
}

async function setMediaStoreWithRetry(key, blob, options, label) {
  let lastError = null;

  for (let attempt = 0; attempt <= MEDIA_STORE_RETRY_DELAYS.length; attempt += 1) {
    try {
      await mediaStore.set(key, blob, options);
      return;
    } catch (error) {
      lastError = error;
      console.error(
        `[shared-content-media] set failed: label="${label}" key="${key}" attempt=${attempt + 1}`,
        error,
      );
    }

    if (attempt < MEDIA_STORE_RETRY_DELAYS.length) {
      await wait(MEDIA_STORE_RETRY_DELAYS[attempt]);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unexpected media store write failure.");
}

export default async function handler(request) {
  try {
    if (request.method === "GET") {
      const key = getRequestKey(request);
      if (!key) {
        return badRequestResponse("Missing media key.");
      }

      const signedUrl = await getMediaSignedUrl(key);
      if (signedUrl) {
        return Response.redirect(signedUrl, 307);
      }

      const result = await mediaStore.getWithMetadata(key, {
        type: "blob",
      });

      if (!result) {
        return new Response("Media not found.", {
          status: 404,
          headers: buildServiceHeaders({
            "Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
          }),
        });
      }

      const mimeType =
        (typeof result.metadata?.mimeType === "string" &&
        result.metadata.mimeType.trim()
          ? result.metadata.mimeType.trim()
          : "") ||
        result.data.type ||
        "application/octet-stream";

      return new Response(result.data, {
        status: 200,
        headers: buildServiceHeaders({
          "Cache-Control": "public, max-age=31536000, immutable",
          "Content-Type": mimeType,
        }),
      });
    }

    if (request.method === "POST") {
      if (!isAuthorized(request)) {
        return unauthorizedResponse();
      }

      const contentType = request.headers.get("content-type") || "";
      if (contentType.startsWith("application/json")) {
        let body;
        try {
          body = await request.json();
        } catch {
          return badRequestResponse("Invalid JSON payload.");
        }

        if (body?.mode === "chunk") {
          const uploadId =
            typeof body.uploadId === "string" ? body.uploadId.trim() : "";
          const totalChunks = Number(body.totalChunks);
          const chunkIndex = Number(body.index);
          const mimeType =
            typeof body.mimeType === "string" && body.mimeType.trim()
              ? body.mimeType.trim()
              : "application/octet-stream";
          const fileName =
            typeof body.fileName === "string" && body.fileName.trim()
              ? body.fileName.trim()
              : "upload.bin";
          const chunkBase64 =
            typeof body.chunkBase64 === "string" ? body.chunkBase64 : "";

          if (
            !uploadId ||
            !chunkBase64 ||
            !Number.isInteger(totalChunks) ||
            !Number.isInteger(chunkIndex) ||
            totalChunks <= 0 ||
            chunkIndex < 0 ||
            chunkIndex >= totalChunks
          ) {
            return badRequestResponse("Invalid upload chunk payload.");
          }

          const chunkKey = getChunkKey(uploadId, chunkIndex);
          const chunkBuffer = Buffer.from(chunkBase64, "base64");
          console.log(
            `[shared-content-media] chunk upload: file="${fileName}" uploadId="${uploadId}" index=${chunkIndex + 1}/${totalChunks} size=${chunkBuffer.length}`,
          );

          await setMediaStoreWithRetry(
            chunkKey,
            new Blob([chunkBuffer], {
              type: mimeType,
            }),
            {
              metadata: {
                fileName,
                kind: "multipart-chunk",
                mimeType,
                totalChunks,
                uploadId,
              },
            },
            `chunk:${fileName}:${chunkIndex + 1}/${totalChunks}`,
          );

          return jsonResponse({
            chunkIndex,
            ok: true,
          });
        }

        if (body?.mode === "complete") {
          const uploadId =
            typeof body.uploadId === "string" ? body.uploadId.trim() : "";
          const totalChunks = Number(body.totalChunks);
          const mimeType =
            typeof body.mimeType === "string" && body.mimeType.trim()
              ? body.mimeType.trim()
              : "application/octet-stream";
          const fileName =
            typeof body.fileName === "string" && body.fileName.trim()
              ? body.fileName.trim()
              : "upload.bin";

          if (
            !uploadId ||
            !Number.isInteger(totalChunks) ||
            totalChunks <= 0
          ) {
            return badRequestResponse("Invalid upload completion payload.");
          }

          console.log(
            `[shared-content-media] completing multipart upload: file="${fileName}" uploadId="${uploadId}" chunks=${totalChunks}`,
          );

          const chunkBlobs = [];
          for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
            const chunkBlob = await mediaStore.get(
              getChunkKey(uploadId, chunkIndex),
              {
                type: "blob",
              },
            );

            if (!chunkBlob) {
              console.error(
                `[shared-content-media] missing chunk during completion: uploadId="${uploadId}" index=${chunkIndex}`,
              );
              return badRequestResponse(`Missing upload chunk ${chunkIndex}.`);
            }

            chunkBlobs.push(chunkBlob);
          }

          const key = createMediaKey(fileName);
          await setMediaStoreWithRetry(
            key,
            new Blob(chunkBlobs, {
              type: mimeType,
            }),
            {
              metadata: {
                fileName,
                mimeType,
              },
            },
            `complete:${fileName}`,
          );

          await Promise.allSettled(
            Array.from({ length: totalChunks }, (_, chunkIndex) =>
              mediaStore.delete(getChunkKey(uploadId, chunkIndex)),
            ),
          );

          console.log(
            `[shared-content-media] completed multipart upload: file="${fileName}" key="${key}" chunks=${totalChunks}`,
          );

          return jsonResponse({
            key,
            mimeType,
          });
        }
      }

      const fileNameHeader = request.headers.get("x-file-name");
      const fileName = fileNameHeader
        ? decodeURIComponent(fileNameHeader)
        : "upload.bin";
      const requestContentType =
        request.headers.get("content-type") || "application/octet-stream";
      const arrayBuffer = await request.arrayBuffer();
      const blob = new Blob([arrayBuffer], {
        type: requestContentType,
      });
      const key = createMediaKey(fileName);

      console.log(
        `[shared-content-media] single upload: file="${fileName}" size=${arrayBuffer.byteLength} type="${requestContentType}"`,
      );

      await setMediaStoreWithRetry(key, blob, {
        metadata: {
          fileName,
          mimeType: requestContentType,
        },
      }, `single:${fileName}`);

      return jsonResponse({
        key,
        mimeType: requestContentType,
      });
    }

    if (request.method === "DELETE") {
      if (!isAuthorized(request)) {
        return unauthorizedResponse();
      }

      const key = getRequestKey(request);
      if (!key) {
        return badRequestResponse("Missing media key.");
      }

      console.log(`[shared-content-media] delete: key="${key}"`);
      await mediaStore.delete(key);
      return emptyResponse(204);
    }

    return methodNotAllowedResponse("GET, POST, DELETE");
  } catch (error) {
    console.error("[shared-content-media] unexpected error", error);
    return jsonResponse(
      {
        message: error instanceof Error ? error.message : "Unexpected media upload error.",
      },
      500,
    );
  }
}
