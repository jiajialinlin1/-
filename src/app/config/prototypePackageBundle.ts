import { loadStoredMediaBlob } from "./mediaStorage";
import type { PrototypePackageFile } from "./projectsSettings";

const HTML_FILE_PATTERN = /\.html?$/i;
const PROTOTYPE_PACKAGE_BUNDLE_VERSION = 1;

interface PrototypePackageBundleFilePayload {
  dataUrl: string;
  mimeType?: string;
  path: string;
}

interface PrototypePackageBundlePayload {
  entryPath: string;
  files: PrototypePackageBundleFilePayload[];
  htmlPaths: string[];
  version: number;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function normalizePrototypePackagePath(path: string) {
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

function sanitizeBundleFileName(name: string) {
  const normalized = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "prototype-package";
}

function isHtmlPath(path: string) {
  return HTML_FILE_PATTERN.test(path);
}

function parsePrototypePackageBundlePayload(
  rawPayload: unknown,
): PrototypePackageBundlePayload | null {
  if (!rawPayload || typeof rawPayload !== "object") {
    return null;
  }

  const candidate = rawPayload as Partial<PrototypePackageBundlePayload>;
  const entryPath =
    typeof candidate.entryPath === "string"
      ? normalizePrototypePackagePath(candidate.entryPath)
      : "";

  if (
    candidate.version !== PROTOTYPE_PACKAGE_BUNDLE_VERSION ||
    !entryPath ||
    !Array.isArray(candidate.files)
  ) {
    return null;
  }

  const files = candidate.files
    .map((file): PrototypePackageBundleFilePayload | null => {
      if (!file || typeof file !== "object") return null;

      const candidateFile = file as Partial<PrototypePackageBundleFilePayload>;
      const path =
        typeof candidateFile.path === "string"
          ? normalizePrototypePackagePath(candidateFile.path)
          : "";

      if (
        !path ||
        typeof candidateFile.dataUrl !== "string" ||
        !candidateFile.dataUrl.trim()
      ) {
        return null;
      }

      return {
        dataUrl: candidateFile.dataUrl.trim(),
        mimeType:
          typeof candidateFile.mimeType === "string" &&
          candidateFile.mimeType.trim()
            ? candidateFile.mimeType.trim()
            : undefined,
        path,
      };
    })
    .filter(
      (file): file is PrototypePackageBundleFilePayload => Boolean(file),
    );

  if (files.length === 0) {
    return null;
  }

  const htmlPaths = Array.isArray(candidate.htmlPaths)
    ? collectPrototypePackageHtmlPaths(candidate.htmlPaths)
    : collectPrototypePackageHtmlPaths(files.map((file) => file.path));

  return {
    entryPath,
    files,
    htmlPaths,
    version: PROTOTYPE_PACKAGE_BUNDLE_VERSION,
  };
}

export function collectPrototypePackageHtmlPaths(paths: string[]) {
  return Array.from(
    new Set(
      paths
        .map((path) => normalizePrototypePackagePath(path))
        .filter((path) => path && isHtmlPath(path)),
    ),
  ).sort((leftPath, rightPath) =>
    leftPath.localeCompare(rightPath, "zh-Hans-CN"),
  );
}

export async function createPrototypePackageBundleFile(options: {
  entryPath: string;
  files: Array<{ file: File; path: string }>;
  packageName: string;
}) {
  const normalizedEntryPath = normalizePrototypePackagePath(options.entryPath) || "index.html";
  const bundleFiles: PrototypePackageBundleFilePayload[] = [];

  for (const { file, path } of options.files) {
    const normalizedPath = normalizePrototypePackagePath(path);
    if (!normalizedPath) continue;

    bundleFiles.push({
      dataUrl: await blobToDataUrl(file),
      mimeType: file.type || undefined,
      path: normalizedPath,
    });
  }

  const payload: PrototypePackageBundlePayload = {
    entryPath: normalizedEntryPath,
    files: bundleFiles,
    htmlPaths: collectPrototypePackageHtmlPaths(
      bundleFiles.map((file) => file.path),
    ),
    version: PROTOTYPE_PACKAGE_BUNDLE_VERSION,
  };

  return new File(
    [JSON.stringify(payload)],
    `${sanitizeBundleFileName(options.packageName)}.prototype-package.json`,
    {
      type: "application/json",
    },
  );
}

export async function loadPrototypePackageBundleFiles(
  src: string | null | undefined,
) {
  if (!src) return [];

  const blob = await loadStoredMediaBlob(src);
  if (!blob) return [];

  let rawPayload: unknown = null;
  try {
    rawPayload = JSON.parse(await blob.text()) as unknown;
  } catch {
    return [];
  }

  const payload = parsePrototypePackageBundlePayload(rawPayload);
  if (!payload) return [];

  return payload.files.map(
    (file): PrototypePackageFile => ({
      mimeType: file.mimeType,
      path: file.path,
      src: file.dataUrl,
    }),
  );
}
