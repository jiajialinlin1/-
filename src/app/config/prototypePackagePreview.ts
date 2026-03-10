import { loadStoredMediaBlob } from "./mediaStorage";
import type { PrototypePackageFile } from "./projectsSettings";

interface PrototypePackagePreviewRuntime {
  cleanup: () => void;
  entryUrl: string | null;
}

const HTML_FILE_PATTERN = /\.html?$/i;
const CSS_FILE_PATTERN = /\.css$/i;
const EXTERNAL_URL_PATTERN =
  /^(?:[a-z][a-z\d+\-.]*:|\/\/|#|data:|blob:|javascript:|mailto:|tel:)/i;

interface PackageFileRecord {
  blob: Blob;
  mimeType: string;
  path: string;
}

type AssetUrlResolver = (rawValue: string) => Promise<string | null>;

function normalizePath(path: string) {
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

function getDirname(path: string) {
  const normalizedPath = normalizePath(path);
  const lastSlashIndex = normalizedPath.lastIndexOf("/");
  return lastSlashIndex >= 0 ? normalizedPath.slice(0, lastSlashIndex) : "";
}

function splitUrlReference(rawValue: string) {
  const normalizedValue = rawValue.trim();
  const hashIndex = normalizedValue.indexOf("#");
  const queryIndex = normalizedValue.indexOf("?");

  let splitIndex = -1;
  if (hashIndex >= 0 && queryIndex >= 0) {
    splitIndex = Math.min(hashIndex, queryIndex);
  } else {
    splitIndex = Math.max(hashIndex, queryIndex);
  }

  if (splitIndex < 0) {
    return { path: normalizedValue, suffix: "" };
  }

  return {
    path: normalizedValue.slice(0, splitIndex),
    suffix: normalizedValue.slice(splitIndex),
  };
}

function resolvePackagePath(currentFilePath: string, rawValue: string) {
  if (!rawValue || EXTERNAL_URL_PATTERN.test(rawValue)) return null;

  const { path, suffix } = splitUrlReference(rawValue);
  if (!path) return null;

  const resolvedPath = path.startsWith("/")
    ? normalizePath(path.slice(1))
    : normalizePath(
        [getDirname(currentFilePath), path].filter(Boolean).join("/"),
      );

  return {
    path: resolvedPath,
    suffix,
  };
}

async function replaceAsync(
  input: string,
  pattern: RegExp,
  replacer: (...args: string[]) => Promise<string>,
) {
  const matches = Array.from(input.matchAll(pattern));
  if (matches.length === 0) return input;

  const replacements = await Promise.all(
    matches.map((match) => replacer(...(match as unknown as string[]))),
  );

  let nextIndex = 0;
  return matches.reduce((result, match, index) => {
    const matchIndex = match.index ?? 0;
    const replacement = replacements[index];
    const chunk = input.slice(nextIndex, matchIndex);
    nextIndex = matchIndex + match[0].length;
    return result + chunk + replacement;
  }, "") + input.slice(nextIndex);
}

export async function createPrototypePackagePreviewRuntime(
  entryPath: string,
  files: PrototypePackageFile[],
): Promise<PrototypePackagePreviewRuntime> {
  const normalizedEntryPath = normalizePath(entryPath);
  const fileRecords = await Promise.all(
    files.map(async (file) => {
      const blob = await loadStoredMediaBlob(file.src);
      if (!blob) return null;

      return {
        path: normalizePath(file.path),
        blob,
        mimeType: file.mimeType || blob.type || "application/octet-stream",
      } satisfies PackageFileRecord;
    }),
  );

  const packageFileMap = new Map<string, PackageFileRecord>(
    fileRecords
      .filter((record): record is PackageFileRecord => Boolean(record))
      .map((record) => [record.path, record]),
  );

  const createdUrls = new Set<string>();
  const directUrlCache = new Map<string, string>();
  const cssUrlCache = new Map<string, Promise<string | null>>();
  const htmlUrlCache = new Map<string, Promise<string | null>>();

  const cleanup = () => {
    createdUrls.forEach((url) => URL.revokeObjectURL(url));
    createdUrls.clear();
    directUrlCache.clear();
    cssUrlCache.clear();
    htmlUrlCache.clear();
  };

  const createBlobUrl = (blob: Blob) => {
    const objectUrl = URL.createObjectURL(blob);
    createdUrls.add(objectUrl);
    return objectUrl;
  };

  const getDirectFileUrl = (path: string) => {
    const cachedUrl = directUrlCache.get(path);
    if (cachedUrl) return cachedUrl;

    const fileRecord = packageFileMap.get(path);
    if (!fileRecord) return null;

    const objectUrl = createBlobUrl(fileRecord.blob);
    directUrlCache.set(path, objectUrl);
    return objectUrl;
  };

  const resolveAssetUrl = async (
    currentFilePath: string,
    rawValue: string,
  ) => {
    const resolvedReference = resolvePackagePath(currentFilePath, rawValue);
    if (!resolvedReference) return null;

    const targetRecord = packageFileMap.get(resolvedReference.path);
    if (!targetRecord) return null;

    const targetPath = resolvedReference.path;
    const targetUrl = CSS_FILE_PATTERN.test(targetPath)
      ? await buildCssUrl(targetPath)
      : HTML_FILE_PATTERN.test(targetPath)
        ? await buildHtmlUrl(targetPath)
      : getDirectFileUrl(targetPath);

    if (!targetUrl) return null;
    return `${targetUrl}${resolvedReference.suffix}`;
  };

  const rewriteCssText = async (cssText: string, currentFilePath: string) => {
    let nextCssText = await replaceAsync(
      cssText,
      /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
      async (match, quote, rawValue) => {
        const rewrittenUrl = await resolveAssetUrl(currentFilePath, rawValue);
        if (!rewrittenUrl) return match;
        return `url(${quote || '"'}${rewrittenUrl}${quote || '"'})`;
      },
    );

    nextCssText = await replaceAsync(
      nextCssText,
      /@import\s+(?:url\(\s*)?(['"])([^'"]+)\1\s*\)?/gi,
      async (match, quote, rawValue) => {
        const rewrittenUrl = await resolveAssetUrl(currentFilePath, rawValue);
        if (!rewrittenUrl) return match;
        return `@import url(${quote}${rewrittenUrl}${quote})`;
      },
    );

    return nextCssText;
  };

  const buildCssUrl = async (path: string) => {
    const normalizedPath = normalizePath(path);
    const cachedPromise = cssUrlCache.get(normalizedPath);
    if (cachedPromise) return cachedPromise;

    const promise = (async () => {
      const fileRecord = packageFileMap.get(normalizedPath);
      if (!fileRecord) return null;

      const cssText = await fileRecord.blob.text();
      const rewrittenCssText = await rewriteCssText(cssText, normalizedPath);
      return createBlobUrl(
        new Blob([rewrittenCssText], { type: fileRecord.mimeType || "text/css" }),
      );
    })();

    cssUrlCache.set(normalizedPath, promise);
    return promise;
  };

  const rewriteSrcsetValue = async (
    srcsetValue: string,
    resolveUrl: AssetUrlResolver,
  ) => {
    const candidates = srcsetValue
      .split(",")
      .map((candidate) => candidate.trim())
      .filter(Boolean);

    const rewrittenCandidates = await Promise.all(
      candidates.map(async (candidate) => {
        const [rawUrl, ...descriptorParts] = candidate.split(/\s+/);
        const rewrittenUrl = await resolveUrl(rawUrl);
        if (!rewrittenUrl) return candidate;

        return [rewrittenUrl, ...descriptorParts].join(" ").trim();
      }),
    );

    return rewrittenCandidates.join(", ");
  };

  const rewriteHtmlText = async (htmlText: string, currentFilePath: string) => {
    const parser = new DOMParser();
    const document = parser.parseFromString(htmlText, "text/html");

    const rewriteElementAttribute = async (
      selector: string,
      attributeName: string,
    ) => {
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(selector),
      );

      await Promise.all(
        elements.map(async (element) => {
          const rawValue = element.getAttribute(attributeName);
          if (!rawValue) return;

          const rewrittenUrl = await resolveAssetUrl(currentFilePath, rawValue);
          if (!rewrittenUrl) return;

          element.setAttribute(attributeName, rewrittenUrl);
        }),
      );
    };

    const rewriteElementSrcsetAttribute = async (
      selector: string,
      attributeName: string,
    ) => {
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(selector),
      );

      await Promise.all(
        elements.map(async (element) => {
          const rawValue = element.getAttribute(attributeName);
          if (!rawValue) return;

          element.setAttribute(
            attributeName,
            await rewriteSrcsetValue(rawValue, async (candidateUrl) =>
              resolveAssetUrl(currentFilePath, candidateUrl),
            ),
          );
        }),
      );
    };

    await rewriteElementAttribute("script[src]", "src");
    await rewriteElementAttribute("img[src]", "src");
    await rewriteElementAttribute("source[src]", "src");
    await rewriteElementSrcsetAttribute("img[srcset]", "srcset");
    await rewriteElementSrcsetAttribute("source[srcset]", "srcset");
    await rewriteElementAttribute("video[src]", "src");
    await rewriteElementAttribute("audio[src]", "src");
    await rewriteElementAttribute("track[src]", "src");
    await rewriteElementAttribute("iframe[src]", "src");
    await rewriteElementAttribute("embed[src]", "src");
    await rewriteElementAttribute("image[href]", "href");
    await rewriteElementAttribute("image[xlink\\:href]", "xlink:href");
    await rewriteElementAttribute("use[href]", "href");
    await rewriteElementAttribute("use[xlink\\:href]", "xlink:href");
    await rewriteElementAttribute(
      "link[rel='stylesheet'][href], link[as='style'][href], link[rel='icon'][href], link[rel='shortcut icon'][href], link[rel='preload'][href], link[rel='modulepreload'][href]",
      "href",
    );
    await rewriteElementAttribute("video[poster]", "poster");
    await rewriteElementAttribute("object[data]", "data");

    const styleElements = Array.from(document.querySelectorAll("style"));
    await Promise.all(
      styleElements.map(async (styleElement) => {
        styleElement.textContent = await rewriteCssText(
          styleElement.textContent || "",
          currentFilePath,
        );
      }),
    );

    const styledElements = Array.from(
      document.querySelectorAll<HTMLElement>("[style]"),
    );
    await Promise.all(
      styledElements.map(async (element) => {
        const inlineStyle = element.getAttribute("style");
        if (!inlineStyle) return;
        element.setAttribute(
          "style",
          await rewriteCssText(inlineStyle, currentFilePath),
        );
      }),
    );

    const serializer = new XMLSerializer();
    return serializer.serializeToString(document);
  };

  const buildHtmlUrl = async (path: string) => {
    const normalizedPath = normalizePath(path);
    const cachedPromise = htmlUrlCache.get(normalizedPath);
    if (cachedPromise) return cachedPromise;

    const promise = (async () => {
      const fileRecord = packageFileMap.get(normalizedPath);
      if (!fileRecord) return null;

      const rewrittenHtmlText = await rewriteHtmlText(
        await fileRecord.blob.text(),
        normalizedPath,
      );
      return createBlobUrl(
        new Blob([rewrittenHtmlText], {
          type: fileRecord.mimeType || "text/html",
        }),
      );
    })();

    htmlUrlCache.set(normalizedPath, promise);
    return promise;
  };

  const entryRecord = packageFileMap.get(normalizedEntryPath);
  if (!entryRecord) {
    cleanup();
    return { cleanup, entryUrl: null };
  }

  const entryUrl = await buildHtmlUrl(normalizedEntryPath);

  return { cleanup, entryUrl };
}
