import {
  collectImageOverrideRefs,
  getImageOverrides,
  replaceImageOverrides,
  type ImageOverrides,
} from "./imageSettings";
import {
  getPersonalInfoSettings,
  savePersonalInfoSettings,
  type PersonalInfoSettings,
} from "./personalInfoSettings";
import {
  getExperiences,
  saveExperiences,
  type ExperienceItem,
} from "./experienceSettings";
import {
  collectProjectMediaRefs,
  getProjects,
  saveProjects,
  type ProjectBackgroundAttachment,
  type ProjectItem,
  type PrototypePackageFile,
} from "./projectsSettings";
import {
  deleteStoredMediaBatch,
  getStoredMediaMimeType,
  isStoredMediaReference,
  loadStoredMediaBlob,
  storeMediaFile,
} from "./mediaStorage";

const TRANSFER_FILE_PREFIX = "portfolio-content-transfer";

interface SharedContentTransferMediaItem {
  dataUrl: string;
  fileName: string;
  mimeType?: string;
  source: string;
}

interface SharedContentTransferDocument {
  experiences: ExperienceItem[];
  imageOverrides: ImageOverrides;
  personalInfo: PersonalInfoSettings;
  projects: ProjectItem[];
}

interface SharedContentTransferPackage {
  document: SharedContentTransferDocument;
  exportedAt: string;
  media: SharedContentTransferMediaItem[];
  version: 1;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string) {
  return fetch(dataUrl).then((response) => response.blob());
}

function getMimeExtension(mimeType: string | undefined) {
  if (!mimeType) return "bin";

  const normalized = mimeType.toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/svg+xml") return "svg";
  if (normalized === "video/mp4") return "mp4";
  if (normalized === "video/webm") return "webm";
  if (normalized === "application/pdf") return "pdf";
  if (normalized === "text/html") return "html";
  if (normalized === "text/plain") return "txt";

  const subtype = normalized.split("/")[1];
  return subtype?.split(";")[0] || "bin";
}

function getTransferFileName() {
  const isoDate = new Date().toISOString().replaceAll(":", "-");
  return `${TRANSFER_FILE_PREFIX}-${isoDate}.json`;
}

function getMediaItemFileName(source: string, mimeType: string | undefined, index: number) {
  const cleanSource = source
    .replace(/^[^:]+:/, "")
    .replace(/[?&=]/g, "-")
    .replace(/[^a-zA-Z0-9._/-]+/g, "-")
    .split("/")
    .filter(Boolean)
    .pop();

  if (cleanSource && /\.[a-z0-9]+$/i.test(cleanSource)) {
    return cleanSource;
  }

  return `asset-${index + 1}.${getMimeExtension(mimeType)}`;
}

function buildTransferDocument(): SharedContentTransferDocument {
  return {
    experiences: getExperiences(),
    imageOverrides: getImageOverrides(),
    personalInfo: getPersonalInfoSettings(),
    projects: getProjects(),
  };
}

function remapProjectAttachments(
  attachments: ProjectBackgroundAttachment[] | undefined,
  refMap: Map<string, string>,
) {
  return (attachments ?? []).map((attachment) => ({
    ...attachment,
    src: refMap.get(attachment.src) || attachment.src,
  }));
}

function remapPrototypeFiles(
  files: PrototypePackageFile[] | undefined,
  refMap: Map<string, string>,
) {
  return (files ?? []).map((file) => ({
    ...file,
    src: refMap.get(file.src) || file.src,
  }));
}

export async function createSharedContentTransferFile() {
  const transferDocument = buildTransferDocument();
  const mediaRefs = Array.from(
    new Set([
      ...collectImageOverrideRefs(),
      ...collectProjectMediaRefs(),
    ]),
  );

  const media: SharedContentTransferMediaItem[] = [];
  for (const [index, ref] of mediaRefs.entries()) {
    const blob = await loadStoredMediaBlob(ref);
    if (!blob) {
      continue;
    }

    const mimeType = getStoredMediaMimeType(ref) || blob.type || undefined;
    media.push({
      dataUrl: await blobToDataUrl(blob),
      fileName: getMediaItemFileName(ref, mimeType, index),
      mimeType,
      source: ref,
    });
  }

  const contentPackage: SharedContentTransferPackage = {
    document: transferDocument,
    exportedAt: new Date().toISOString(),
    media,
    version: 1,
  };

  return new File(
    [JSON.stringify(contentPackage, null, 2)],
    getTransferFileName(),
    {
      type: "application/json",
    },
  );
}

export async function importSharedContentTransferFile(file: File) {
  const rawText = await file.text();
  const parsed = JSON.parse(rawText) as Partial<SharedContentTransferPackage>;

  if (parsed.version !== 1 || !parsed.document || typeof parsed.document !== "object") {
    throw new Error("INVALID_TRANSFER_PACKAGE");
  }

  const uploadedRefs: string[] = [];
  const refMap = new Map<string, string>();
  const mediaItems = Array.isArray(parsed.media) ? parsed.media : [];

  try {
    for (const mediaItem of mediaItems) {
      if (
        !mediaItem ||
        typeof mediaItem !== "object" ||
        typeof mediaItem.source !== "string" ||
        typeof mediaItem.dataUrl !== "string"
      ) {
        continue;
      }

      const blob = await dataUrlToBlob(mediaItem.dataUrl);
      const mimeType =
        typeof mediaItem.mimeType === "string" && mediaItem.mimeType.trim()
          ? mediaItem.mimeType.trim()
          : blob.type || "application/octet-stream";
      const uploadFile = new File(
        [blob],
        mediaItem.fileName || getMediaItemFileName(mediaItem.source, mimeType, uploadedRefs.length),
        {
          type: mimeType,
        },
      );
      const storedRef = await storeMediaFile(uploadFile);
      uploadedRefs.push(storedRef);
      refMap.set(mediaItem.source, storedRef);
    }
  } catch (error) {
    await deleteStoredMediaBatch(uploadedRefs);
    throw error;
  }

  const nextDocument = parsed.document as SharedContentTransferDocument;
  const nextImageOverrides = Object.fromEntries(
    Object.entries(nextDocument.imageOverrides || {}).map(([slotId, src]) => [
      slotId,
      typeof src === "string" && isStoredMediaReference(src)
        ? refMap.get(src) || src
        : src,
    ]),
  ) as ImageOverrides;

  const nextProjects = Array.isArray(nextDocument.projects)
    ? nextDocument.projects.map((project) => ({
        ...project,
        image:
          typeof project.image === "string" && isStoredMediaReference(project.image)
            ? refMap.get(project.image) || project.image
            : project.image,
        backgroundAttachments: remapProjectAttachments(
          project.backgroundAttachments,
          refMap,
        ),
        designImages: (project.designImages ?? []).map((src) =>
          isStoredMediaReference(src) ? refMap.get(src) || src : src,
        ),
        prototypeHtml:
          typeof project.prototypeHtml === "string" &&
          isStoredMediaReference(project.prototypeHtml)
            ? refMap.get(project.prototypeHtml) || project.prototypeHtml
            : project.prototypeHtml,
        prototypeFiles: remapPrototypeFiles(project.prototypeFiles, refMap),
      }))
    : [];

  replaceImageOverrides(nextImageOverrides);
  savePersonalInfoSettings(nextDocument.personalInfo || getPersonalInfoSettings());
  saveExperiences(
    Array.isArray(nextDocument.experiences)
      ? nextDocument.experiences
      : getExperiences(),
  );
  saveProjects(nextProjects.length > 0 ? nextProjects : getProjects());

  return {
    experiences: Array.isArray(nextDocument.experiences)
      ? nextDocument.experiences
      : getExperiences(),
    imageOverrides: nextImageOverrides,
    personalInfo: nextDocument.personalInfo || getPersonalInfoSettings(),
    projects: nextProjects.length > 0 ? nextProjects : getProjects(),
  };
}
