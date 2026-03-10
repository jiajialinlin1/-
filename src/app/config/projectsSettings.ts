import { getImageSrc, type ImageSlotId } from "./imageSettings";
import {
  getStoredMediaMimeType,
  isStoredMediaReference,
  migrateDataUrlToStoredMedia,
  resolveStoredMediaSrc,
} from "./mediaStorage";

export const PROJECTS_STORAGE_KEY = "portfolio_projects_v1";
const DESIGN_VIDEO_DATA_URL_PATTERN = /^data:video\//i;
const DESIGN_VIDEO_FILE_PATTERN =
  /\.(mp4|webm|ogg|mov|m4v)(?:$|[?#])/i;
const PROJECT_MEDIA_DISPLAY_MODES = new Set(["desktop", "mobile"]);
const PROJECT_IMAGE_SLOTS = new Set<ImageSlotId>([
  "projectErp",
  "projectKnowledge",
  "projectSmartHome",
  "projectMedical",
]);

export type ProjectMediaDisplayMode = "desktop" | "mobile";

export interface PrototypePackageFile {
  path: string;
  src: string;
  mimeType?: string;
}

export interface ProjectBackgroundAttachment {
  name: string;
  src: string;
  mimeType?: string;
}

export interface ProjectItem {
  id: string;
  title: string;
  category: string;
  description: string;
  background: string;
  backgroundAttachments?: ProjectBackgroundAttachment[];
  designImages: string[];
  designImageDisplayModes?: ProjectMediaDisplayMode[];
  reverse: boolean;
  showOnHome: boolean;
  imageSlot?: ImageSlotId;
  image?: string;
  imageDisplayMode?: ProjectMediaDisplayMode;
  prototypeBundle?: string;
  prototypeHtml?: string;
  prototypeHtmlPaths?: string[];
  prototypeName?: string;
  prototypeEntryPath?: string;
  prototypeFiles?: PrototypePackageFile[];
}

const DEFAULT_PROJECTS: ProjectItem[] = [
  {
    id: "project-erp",
    title: "企业资源管理系统 (ERP)",
    category: "B端后台系统",
    description:
      "负责核心业务模块（PC端与移动端）的交互逻辑设计，梳理业务流程图，优化信息架构。基于 Element UI 框架规范，使用墨刀搭建了一套包含 40+ 常用控件的交互组件库。确保设计稿与前端代码组件的 1:1 对应，减少了 90% 的样式沟通成本，将开发还原度提升至 95% 以上。统一多端交互规范，降低用户学习成本。",
    background:
      "企业从多套割裂系统切换到统一 ERP 平台后，需要重新梳理核心业务路径、权限模型和多端协同方式。我负责从业务流程拆解、后台信息架构到交互组件规范的整体设计，确保复杂流程在不同角色下都能快速理解和高效完成。",
    designImages: [],
    reverse: false,
    showOnHome: true,
    imageSlot: "projectErp",
  },
  {
    id: "project-knowledge",
    title: "知识付费产品",
    category: "C端小程序",
    description:
      "交互规划与界面设计。通过优化课程详情页的信息层级与支付转化路径，提升用户购课体验。输出高保真交互原型（Axure/墨刀），配合开发团队进行还原度验收。",
    background:
      "项目面向内容付费场景，核心目标是提升课程详情到支付转化的效率，同时降低用户在选课、试看和下单过程中的决策成本。我负责梳理用户决策路径，并重构课程信息层级与购买流程。",
    designImages: [],
    reverse: true,
    showOnHome: true,
    imageSlot: "projectKnowledge",
  },
  {
    id: "project-smart-home",
    title: "智能家居控制中心",
    category: "IoT 移动端应用",
    description:
      "主导智能家居中控App的体验重构，引入微动效与毛玻璃质感，将设备控制成功率提升20%，日活用户增长15%。建立全局状态反馈体系，降低用户误操作率。",
    background:
      "随着设备数量增长，原有控制中心在场景编排、设备状态反馈和异常提醒上的体验逐渐失效。本项目围绕设备管理效率与操作信心重构移动端控制体验，重点优化高频控制任务的响应感与可理解性。",
    designImages: [],
    reverse: false,
    showOnHome: false,
    imageSlot: "projectSmartHome",
  },
  {
    id: "project-medical",
    title: "数字医疗看板系统",
    category: "医疗数据可视化",
    description:
      "将繁杂的患者数据可视化为直观的仪表盘，提升医护人员查房效率。优化深色模式下的对比度与数据层级显示，支持多端数据实时同步。",
    background:
      "医院多个业务系统的数据格式和展示逻辑并不统一，导致医护人员在查房和研判时需要频繁切换页面。本项目聚焦复杂医疗指标的可视化整合，希望在安全合规前提下提升数据读取效率和决策速度。",
    designImages: [],
    reverse: true,
    showOnHome: false,
    imageSlot: "projectMedical",
  },
];

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function sanitizeProjectMediaDisplayMode(
  displayMode: unknown,
): ProjectMediaDisplayMode {
  return typeof displayMode === "string" &&
    PROJECT_MEDIA_DISPLAY_MODES.has(displayMode)
    ? (displayMode as ProjectMediaDisplayMode)
    : "desktop";
}

function sanitizeProject(input: unknown): ProjectItem | null {
  if (!input || typeof input !== "object") return null;

  const candidate = input as Partial<ProjectItem>;
  if (!candidate.id || typeof candidate.id !== "string") return null;
  const defaultProject = DEFAULT_PROJECTS.find((project) => project.id === candidate.id);
  const normalizedDesignImages = Array.isArray(candidate.designImages)
    ? candidate.designImages.filter(
        (image): image is string =>
          typeof image === "string" && image.trim().length > 0,
      )
    : [];

  const normalized: ProjectItem = {
    id: candidate.id,
    title:
      typeof candidate.title === "string"
        ? candidate.title
        : (defaultProject?.title ?? ""),
    category:
      typeof candidate.category === "string"
        ? candidate.category
        : (defaultProject?.category ?? ""),
    description:
      typeof candidate.description === "string"
        ? candidate.description
        : (defaultProject?.description ?? ""),
    background:
      typeof candidate.background === "string"
        ? candidate.background
        : (defaultProject?.background ?? ""),
    backgroundAttachments: Array.isArray(candidate.backgroundAttachments)
      ? candidate.backgroundAttachments
          .map((attachment): ProjectBackgroundAttachment | null => {
            if (!attachment || typeof attachment !== "object") return null;

            const candidateAttachment =
              attachment as Partial<ProjectBackgroundAttachment>;

            if (
              typeof candidateAttachment.name !== "string" ||
              !candidateAttachment.name.trim() ||
              typeof candidateAttachment.src !== "string" ||
              !candidateAttachment.src.trim()
            ) {
              return null;
            }

            return {
              name: candidateAttachment.name.trim(),
              src: candidateAttachment.src.trim(),
              mimeType:
                typeof candidateAttachment.mimeType === "string" &&
                candidateAttachment.mimeType.trim()
                  ? candidateAttachment.mimeType.trim()
                  : undefined,
            };
          })
          .filter(
            (attachment): attachment is ProjectBackgroundAttachment =>
              Boolean(attachment),
          )
      : [],
    designImages: normalizedDesignImages,
    designImageDisplayModes: normalizedDesignImages.map((_, index) =>
      sanitizeProjectMediaDisplayMode(
        Array.isArray(candidate.designImageDisplayModes)
          ? candidate.designImageDisplayModes[index]
          : undefined,
      ),
    ),
    reverse: Boolean(candidate.reverse),
    showOnHome: Boolean(candidate.showOnHome),
    imageDisplayMode: sanitizeProjectMediaDisplayMode(candidate.imageDisplayMode),
  };

  if (typeof candidate.image === "string" && candidate.image.trim()) {
    normalized.image = candidate.image.trim();
  }

  if (typeof candidate.prototypeHtml === "string" && candidate.prototypeHtml.trim()) {
    normalized.prototypeHtml = candidate.prototypeHtml.trim();
  }

  if (
    typeof candidate.prototypeBundle === "string" &&
    candidate.prototypeBundle.trim()
  ) {
    normalized.prototypeBundle = candidate.prototypeBundle.trim();
  }

  if (typeof candidate.prototypeName === "string" && candidate.prototypeName.trim()) {
    normalized.prototypeName = candidate.prototypeName.trim();
  }

  if (
    typeof candidate.prototypeEntryPath === "string" &&
    candidate.prototypeEntryPath.trim()
  ) {
    normalized.prototypeEntryPath = candidate.prototypeEntryPath.trim();
  }

  if (Array.isArray(candidate.prototypeHtmlPaths)) {
    normalized.prototypeHtmlPaths = Array.from(
      new Set(
        candidate.prototypeHtmlPaths
          .filter(
            (path): path is string =>
              typeof path === "string" && /\.html?$/i.test(path.trim()),
          )
          .map((path) => path.trim())
          .filter(Boolean),
      ),
    ).sort((leftPath, rightPath) =>
      leftPath.localeCompare(rightPath, "zh-Hans-CN"),
    );
  }

  if (Array.isArray(candidate.prototypeFiles)) {
    normalized.prototypeFiles = candidate.prototypeFiles
      .map((file): PrototypePackageFile | null => {
        if (!file || typeof file !== "object") return null;

        const candidateFile = file as Partial<PrototypePackageFile>;
        if (
          typeof candidateFile.path !== "string" ||
          !candidateFile.path.trim() ||
          typeof candidateFile.src !== "string" ||
          !candidateFile.src.trim()
        ) {
          return null;
        }

        return {
          path: candidateFile.path.trim(),
          src: candidateFile.src.trim(),
          mimeType:
            typeof candidateFile.mimeType === "string" && candidateFile.mimeType.trim()
              ? candidateFile.mimeType.trim()
              : undefined,
        };
      })
      .filter((file): file is PrototypePackageFile => Boolean(file));
  }

  if (typeof candidate.imageSlot === "string" && PROJECT_IMAGE_SLOTS.has(candidate.imageSlot as ImageSlotId)) {
    normalized.imageSlot = candidate.imageSlot as ImageSlotId;
  }

  return normalized;
}

export function getProjects(): ProjectItem[] {
  if (!isBrowser()) return DEFAULT_PROJECTS;

  try {
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return DEFAULT_PROJECTS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_PROJECTS;

    const projects = parsed
      .map((item) => sanitizeProject(item))
      .filter((item): item is ProjectItem => Boolean(item));

    return projects.length > 0 ? projects : DEFAULT_PROJECTS;
  } catch {
    return DEFAULT_PROJECTS;
  }
}

export function saveProjects(projects: ProjectItem[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

export function createBlankProject(index: number): ProjectItem {
  const now = Date.now();
  return {
    id: `project-custom-${now}-${index}`,
    title: "",
    category: "",
    description: "",
    background: "",
    backgroundAttachments: [],
    designImages: [],
    designImageDisplayModes: [],
    reverse: index % 2 === 1,
    showOnHome: false,
    imageDisplayMode: "desktop",
  };
}

export function getProjectImageSrc(project: ProjectItem): string | null {
  if (project.image && project.image.trim()) {
    return resolveStoredMediaSrc(project.image);
  }
  if (project.imageSlot) return getImageSrc(project.imageSlot);
  return null;
}

export function getProjectImageDisplayMode(project: ProjectItem): ProjectMediaDisplayMode {
  return sanitizeProjectMediaDisplayMode(project.imageDisplayMode);
}

export function getProjectById(projectId: string | undefined): ProjectItem | null {
  if (!projectId) return null;
  return getProjects().find((project) => project.id === projectId) ?? null;
}

export function isProjectDesignVideo(src: string): boolean {
  const normalizedSrc = src.trim();
  const storedMediaMimeType = getStoredMediaMimeType(normalizedSrc);

  if (storedMediaMimeType) {
    return storedMediaMimeType.startsWith("video/");
  }

  return (
    DESIGN_VIDEO_DATA_URL_PATTERN.test(normalizedSrc) ||
    DESIGN_VIDEO_FILE_PATTERN.test(normalizedSrc)
  );
}

export function getProjectDesignMediaSrc(src: string) {
  return resolveStoredMediaSrc(src);
}

export function getProjectDesignMediaDisplayMode(
  project: ProjectItem,
  index: number,
): ProjectMediaDisplayMode {
  return sanitizeProjectMediaDisplayMode(project.designImageDisplayModes?.[index]);
}

export function getProjectMediaDisplayModeLabel(
  displayMode: ProjectMediaDisplayMode,
) {
  return displayMode === "mobile" ? "移动" : "PC";
}

export function getProjectBackgroundAttachments(project: ProjectItem) {
  return project.backgroundAttachments ?? [];
}

export function getProjectBackgroundAttachmentSrc(src: string) {
  return resolveStoredMediaSrc(src);
}

export function getProjectBackgroundAttachmentMimeType(
  attachment: ProjectBackgroundAttachment,
) {
  return attachment.mimeType || getStoredMediaMimeType(attachment.src) || "";
}

export function isProjectBackgroundAttachmentPreviewable(
  attachment: ProjectBackgroundAttachment,
) {
  const mimeType = getProjectBackgroundAttachmentMimeType(attachment);
  if (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/") ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/")
  ) {
    return true;
  }

  return /\.(png|jpe?g|gif|webp|svg|mp4|webm|ogg|mp3|wav|pdf|txt|md|csv|json|html?)$/i.test(
    attachment.name,
  );
}

export function hasProjectPrototype(project: ProjectItem) {
  return Boolean(
    (project.prototypeEntryPath &&
      ((project.prototypeBundle && project.prototypeBundle.trim()) ||
        (project.prototypeFiles && project.prototypeFiles.length > 0))) ||
      (project.prototypeHtml && project.prototypeHtml.trim()),
  );
}

export function getProjectPrototypeSrc(project: ProjectItem) {
  if (!project.prototypeHtml) return null;
  return resolveStoredMediaSrc(project.prototypeHtml);
}

export function hasProjectPrototypePackage(project: ProjectItem) {
  return Boolean(
    project.prototypeEntryPath &&
      ((project.prototypeBundle && project.prototypeBundle.trim()) ||
        (project.prototypeFiles && project.prototypeFiles.length > 0)),
  );
}

export function getProjectPrototypePackageFiles(project: ProjectItem) {
  return project.prototypeFiles ?? [];
}

export function getProjectPrototypeEntryPath(project: ProjectItem) {
  if (hasProjectPrototypePackage(project)) {
    return project.prototypeEntryPath ?? null;
  }

  if (project.prototypeHtml) {
    return project.prototypeName || "index.html";
  }

  return null;
}

export function getProjectPrototypeEntryCandidates(project: ProjectItem) {
  if (hasProjectPrototypePackage(project)) {
    if (project.prototypeBundle) {
      return (project.prototypeHtmlPaths ?? []).length > 0
        ? [...(project.prototypeHtmlPaths ?? [])]
        : project.prototypeEntryPath
          ? [project.prototypeEntryPath]
          : [];
    }

    return (project.prototypeFiles ?? [])
      .map((file) => file.path)
      .filter((path) => /\.html?$/i.test(path))
      .sort((leftPath, rightPath) => leftPath.localeCompare(rightPath, "zh-Hans-CN"));
  }

  if (project.prototypeHtml) {
    return [project.prototypeName || "index.html"];
  }

  return [];
}

export function collectProjectMediaRefs() {
  return getProjects().flatMap((project) =>
    [
      project.image,
      project.prototypeBundle,
      project.prototypeHtml,
      ...(project.backgroundAttachments?.map((attachment) => attachment.src) ?? []),
      ...project.designImages,
      ...(project.prototypeFiles?.map((file) => file.src) ?? []),
    ].filter((src): src is string => isStoredMediaReference(src)),
  );
}

export async function migrateProjectsMediaToIndexedDb() {
  if (!isBrowser()) return;

  const currentProjects = getProjects();
  if (currentProjects.length === 0) return;

  let changed = false;
  const nextProjects = await Promise.all(
    currentProjects.map(async (project) => {
      let nextImage = project.image;
      let nextBackgroundAttachments = project.backgroundAttachments;
      let nextDesignImages = project.designImages;
      let nextPrototypeBundle = project.prototypeBundle;
      let nextPrototypeHtml = project.prototypeHtml;
      let nextPrototypeFiles = project.prototypeFiles;

      if (
        nextImage &&
        !isStoredMediaReference(nextImage) &&
        nextImage.startsWith("data:")
      ) {
        nextImage = await migrateDataUrlToStoredMedia(nextImage);
        changed = true;
      }

      if (
        nextBackgroundAttachments?.some(
          (attachment) =>
            !isStoredMediaReference(attachment.src) &&
            attachment.src.startsWith("data:"),
        )
      ) {
        nextBackgroundAttachments = await Promise.all(
          nextBackgroundAttachments.map(async (attachment) => {
            if (
              isStoredMediaReference(attachment.src) ||
              !attachment.src.startsWith("data:")
            ) {
              return attachment;
            }

            changed = true;
            return {
              ...attachment,
              src: await migrateDataUrlToStoredMedia(attachment.src),
            };
          }),
        );
      }

      if (
        nextDesignImages.some(
          (src) => !isStoredMediaReference(src) && src.startsWith("data:"),
        )
      ) {
        nextDesignImages = await Promise.all(
          nextDesignImages.map(async (src) => {
            if (isStoredMediaReference(src) || !src.startsWith("data:")) {
              return src;
            }

            changed = true;
            return migrateDataUrlToStoredMedia(src);
          }),
        );
      }

      if (
        nextPrototypeBundle &&
        !isStoredMediaReference(nextPrototypeBundle) &&
        nextPrototypeBundle.startsWith("data:")
      ) {
        nextPrototypeBundle = await migrateDataUrlToStoredMedia(nextPrototypeBundle);
        changed = true;
      }

      if (
        nextPrototypeHtml &&
        !isStoredMediaReference(nextPrototypeHtml) &&
        nextPrototypeHtml.startsWith("data:")
      ) {
        nextPrototypeHtml = await migrateDataUrlToStoredMedia(nextPrototypeHtml);
        changed = true;
      }

      if (
        nextPrototypeFiles?.some(
          (file) =>
            !isStoredMediaReference(file.src) && file.src.startsWith("data:"),
        )
      ) {
        nextPrototypeFiles = await Promise.all(
          nextPrototypeFiles.map(async (file) => {
            if (
              isStoredMediaReference(file.src) ||
              !file.src.startsWith("data:")
            ) {
              return file;
            }

            changed = true;
            return {
              ...file,
              src: await migrateDataUrlToStoredMedia(file.src),
            };
          }),
        );
      }

      return {
        ...project,
        image: nextImage,
        backgroundAttachments: nextBackgroundAttachments,
        designImages: nextDesignImages,
        prototypeBundle: nextPrototypeBundle,
        prototypeHtml: nextPrototypeHtml,
        prototypeFiles: nextPrototypeFiles,
      };
    }),
  );

  if (changed) {
    saveProjects(nextProjects);
  }
}
