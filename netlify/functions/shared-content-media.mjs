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

function getRequestKey(request) {
  return new URL(request.url).searchParams.get("key")?.trim() || "";
}

export default async function handler(request) {
  if (request.method === "GET") {
    const key = getRequestKey(request);
    if (!key) {
      return badRequestResponse("Missing media key.");
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

    const fileNameHeader = request.headers.get("x-file-name");
    const fileName = fileNameHeader
      ? decodeURIComponent(fileNameHeader)
      : "upload.bin";
    const contentType =
      request.headers.get("content-type") || "application/octet-stream";
    const arrayBuffer = await request.arrayBuffer();
    const blob = new Blob([arrayBuffer], {
      type: contentType,
    });
    const key = createMediaKey(fileName);

    await mediaStore.set(key, blob, {
      metadata: {
        fileName,
        mimeType: contentType,
      },
    });

    return jsonResponse({
      key,
      mimeType: contentType,
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

    await mediaStore.delete(key);
    return emptyResponse(204);
  }

  return methodNotAllowedResponse("GET, POST, DELETE");
}
