import { getStore } from "@netlify/blobs";

export const SHARED_CONTENT_SERVICE_HEADER_NAME = "x-portfolio-shared-content";
export const SHARED_CONTENT_SERVICE_HEADER_VALUE = "netlify";
export const SHARED_CONTENT_PASSWORD_HEADER_NAME = "x-portfolio-admin-password";
const DEFAULT_ADMIN_PASSWORD = "sml2846499028";

export const contentStore = getStore("portfolio-shared-content");
export const mediaStore = getStore("portfolio-shared-media");

function normalizeFileName(fileName) {
  return fileName
    .trim()
    .replace(/%/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "file";
}

export function buildServiceHeaders(extraHeaders = {}) {
  return {
    [SHARED_CONTENT_SERVICE_HEADER_NAME]: SHARED_CONTENT_SERVICE_HEADER_VALUE,
    ...extraHeaders,
  };
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildServiceHeaders({
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    }),
  });
}

export function emptyResponse(status = 204, extraHeaders = {}) {
  return new Response(null, {
    status,
    headers: buildServiceHeaders({
      "Cache-Control": "no-store",
      ...extraHeaders,
    }),
  });
}

export function methodNotAllowedResponse(allow) {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: buildServiceHeaders({
      Allow: allow,
      "Cache-Control": "no-store",
    }),
  });
}

export function badRequestResponse(message) {
  return jsonResponse(
    {
      message,
    },
    400,
  );
}

export function unauthorizedResponse() {
  return jsonResponse(
    {
      message: "Unauthorized",
    },
    401,
  );
}

export function getAdminPassword() {
  return process.env.PORTFOLIO_ADMIN_PASSWORD?.trim() || DEFAULT_ADMIN_PASSWORD;
}

export function isAuthorized(request) {
  return (
    request.headers.get(SHARED_CONTENT_PASSWORD_HEADER_NAME) ===
    getAdminPassword()
  );
}

export function createMediaKey(fileName = "file") {
  const normalizedFileName = normalizeFileName(fileName);
  const uniqueId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `uploads/${Date.now()}-${uniqueId}-${normalizedFileName}`;
}
