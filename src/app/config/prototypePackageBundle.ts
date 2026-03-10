import { loadStoredMediaBlob } from "./mediaStorage";
import type { PrototypePreviewSessionFile } from "./prototypePreviewSession";

const HTML_FILE_PATTERN = /\.html?$/i;
const PROTOTYPE_PACKAGE_BUNDLE_VERSION = 1;
const PROTOTYPE_PACKAGE_ARCHIVE_VERSION = 2;
const PROTOTYPE_PACKAGE_ARCHIVE_MAGIC = "PPKGV2\0";
const ARCHIVE_PREFIX_SIZE = PROTOTYPE_PACKAGE_ARCHIVE_MAGIC.length + 4;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

interface PrototypePackageArchiveManifestFile {
  mimeType?: string;
  offset: number;
  path: string;
  size: number;
}

interface PrototypePackageArchiveManifest {
  entryPath: string;
  files: PrototypePackageArchiveManifestFile[];
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
  const archiveFiles = options.files
    .map(({ file, path }) => ({
      file,
      mimeType: file.type || undefined,
      path: normalizePrototypePackagePath(path),
      size: file.size,
    }))
    .filter((file) => file.path);

  let currentOffset = 0;
  const manifest: PrototypePackageArchiveManifest = {
    entryPath: normalizedEntryPath,
    files: archiveFiles.map((file) => {
      const manifestFile: PrototypePackageArchiveManifestFile = {
        mimeType: file.mimeType,
        offset: currentOffset,
        path: file.path,
        size: file.size,
      };

      currentOffset += file.size;
      return manifestFile;
    }),
    htmlPaths: collectPrototypePackageHtmlPaths(
      archiveFiles.map((file) => file.path),
    ),
    version: PROTOTYPE_PACKAGE_ARCHIVE_VERSION,
  };
  const manifestBytes = textEncoder.encode(JSON.stringify(manifest));
  const archivePrefix = new Uint8Array(ARCHIVE_PREFIX_SIZE);

  archivePrefix.set(textEncoder.encode(PROTOTYPE_PACKAGE_ARCHIVE_MAGIC), 0);
  new DataView(archivePrefix.buffer).setUint32(
    PROTOTYPE_PACKAGE_ARCHIVE_MAGIC.length,
    manifestBytes.byteLength,
    false,
  );

  return new File(
    [
      archivePrefix,
      manifestBytes,
      ...archiveFiles.map((file) => file.file),
    ],
    `${sanitizeBundleFileName(options.packageName)}.prototype-package.bin`,
    {
      type: "application/octet-stream",
    },
  );
}

export async function loadPrototypePackageBundleFiles(
  src: string | null | undefined,
) {
  if (!src) return [];

  const blob = await loadStoredMediaBlob(src);
  if (!blob) return [];

  const archivePrefixBuffer = await blob
    .slice(0, ARCHIVE_PREFIX_SIZE)
    .arrayBuffer();
  const archivePrefixBytes = new Uint8Array(archivePrefixBuffer);
  const archiveMagic = textDecoder.decode(
    archivePrefixBytes.slice(0, PROTOTYPE_PACKAGE_ARCHIVE_MAGIC.length),
  );

  if (archiveMagic === PROTOTYPE_PACKAGE_ARCHIVE_MAGIC) {
    const manifestLength = new DataView(archivePrefixBuffer).getUint32(
      PROTOTYPE_PACKAGE_ARCHIVE_MAGIC.length,
      false,
    );
    const manifestBuffer = await blob
      .slice(ARCHIVE_PREFIX_SIZE, ARCHIVE_PREFIX_SIZE + manifestLength)
      .arrayBuffer();

    let manifest: PrototypePackageArchiveManifest | null = null;
    try {
      manifest = JSON.parse(
        textDecoder.decode(manifestBuffer),
      ) as PrototypePackageArchiveManifest;
    } catch {
      manifest = null;
    }

    if (
      !manifest ||
      manifest.version !== PROTOTYPE_PACKAGE_ARCHIVE_VERSION ||
      typeof manifest.entryPath !== "string" ||
      !Array.isArray(manifest.files)
    ) {
      return [];
    }

    const binaryStart = ARCHIVE_PREFIX_SIZE + manifestLength;
    return manifest.files
      .map((file): PrototypePreviewSessionFile | null => {
        if (
          !file ||
          typeof file !== "object" ||
          typeof file.path !== "string" ||
          typeof file.offset !== "number" ||
          typeof file.size !== "number" ||
          file.offset < 0 ||
          file.size < 0
        ) {
          return null;
        }

        const normalizedPath = normalizePrototypePackagePath(file.path);
        if (!normalizedPath) {
          return null;
        }

        return {
          blobData: blob.slice(
            binaryStart + file.offset,
            binaryStart + file.offset + file.size,
            file.mimeType || undefined,
          ),
          mimeType:
            typeof file.mimeType === "string" && file.mimeType.trim()
              ? file.mimeType.trim()
              : undefined,
          path: normalizedPath,
        };
      })
      .filter((file): file is PrototypePreviewSessionFile => Boolean(file));
  }

  let rawPayload: unknown = null;
  try {
    rawPayload = JSON.parse(await blob.text()) as unknown;
  } catch {
    return [];
  }

  const payload = parsePrototypePackageBundlePayload(rawPayload);
  if (!payload) return [];

  return payload.files.map(
    (file): PrototypePreviewSessionFile => ({
      blobData: undefined,
      mimeType: file.mimeType,
      path: file.path,
      src: file.dataUrl,
    }),
  );
}
