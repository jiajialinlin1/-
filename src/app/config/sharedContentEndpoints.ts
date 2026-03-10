export const SHARED_CONTENT_SERVICE_HEADER_NAME = "x-portfolio-shared-content";
export const SHARED_CONTENT_SERVICE_HEADER_VALUE = "netlify";
export const SHARED_CONTENT_PASSWORD_HEADER_NAME = "x-portfolio-admin-password";

export const SHARED_CONTENT_ENDPOINT = "/.netlify/functions/shared-content";
export const SHARED_CONTENT_AUTH_ENDPOINT =
  "/.netlify/functions/shared-content-auth";
export const SHARED_CONTENT_MEDIA_ENDPOINT =
  "/.netlify/functions/shared-content-media";

const REMOTE_MEDIA_REF_PREFIX = "netlify:";

export interface RemoteMediaReference {
  key: string;
  mimeType?: string;
}

export function createSharedContentAuthHeaders(password: string) {
  return {
    [SHARED_CONTENT_PASSWORD_HEADER_NAME]: password,
  };
}

export function hasSharedContentServiceHeader(
  headers: Headers | null | undefined,
) {
  return (
    headers?.get(SHARED_CONTENT_SERVICE_HEADER_NAME) ===
    SHARED_CONTENT_SERVICE_HEADER_VALUE
  );
}

export function createRemoteMediaReference(
  key: string,
  mimeType?: string | null,
) {
  const params = new URLSearchParams({
    key,
  });

  if (mimeType && mimeType.trim()) {
    params.set("mimeType", mimeType.trim());
  }

  return `${REMOTE_MEDIA_REF_PREFIX}${params.toString()}`;
}

export function parseRemoteMediaReference(
  src: string | null | undefined,
): RemoteMediaReference | null {
  if (!src || !src.trim().startsWith(REMOTE_MEDIA_REF_PREFIX)) {
    return null;
  }

  const params = new URLSearchParams(
    src.trim().slice(REMOTE_MEDIA_REF_PREFIX.length),
  );
  const key = params.get("key");

  if (!key || !key.trim()) {
    return null;
  }

  const mimeType = params.get("mimeType");
  return {
    key: key.trim(),
    mimeType: mimeType && mimeType.trim() ? mimeType.trim() : undefined,
  };
}

export function isRemoteMediaReference(src: string | null | undefined) {
  return Boolean(parseRemoteMediaReference(src));
}

export function buildRemoteMediaUrl(key: string) {
  const params = new URLSearchParams({
    key,
  });

  return `${SHARED_CONTENT_MEDIA_ENDPOINT}?${params.toString()}`;
}
