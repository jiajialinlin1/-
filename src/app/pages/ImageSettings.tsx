import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Link } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Briefcase,
  Check,
  Download,
  Eye,
  FileText,
  ImagePlus,
  Images,
  Monitor,
  Paperclip,
  Plus,
  RotateCcw,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { ProjectMediaFrame } from "../components/ProjectMediaFrame";
import {
  clearAllImageOverrides,
  clearImageOverride,
  getImageOverrides,
  getImageSrc,
  setImageOverride,
} from "../config/imageSettings";
import {
  deleteStoredMedia,
  deleteStoredMediaBatch,
  isRemoteMediaReference,
  storeMediaFile,
} from "../config/mediaStorage";
import {
  getPersonalInfoSettings,
  savePersonalInfoSettings,
  type PersonalInfoSettings,
} from "../config/personalInfoSettings";
import { revokeImageSettingsAccess } from "../config/imageSettingsAccess";
import { openProjectPrototypeWindow } from "../config/projectPrototypeWindow";
import {
  createBlankExperience,
  getExperiences,
  saveExperiences,
  type ExperienceItem,
} from "../config/experienceSettings";
import {
  createBlankProject,
  getProjectBackgroundAttachmentSrc,
  getProjectBackgroundAttachments,
  getProjectBackgroundAttachmentMimeType,
  getProjectDesignMediaDisplayMode,
  getProjectPrototypeEntryCandidates,
  getProjectDesignMediaSrc,
  getProjectImageDisplayMode,
  getProjectImageSrc,
  getProjectMediaDisplayModeLabel,
  getProjects,
  hasProjectPrototype,
  isProjectBackgroundAttachmentPreviewable,
  isProjectDesignVideo,
  saveProjects,
  type ProjectMediaDisplayMode,
  type ProjectItem,
} from "../config/projectsSettings";
import {
  getSharedContentMode,
  hasRemoteSharedContentService,
  syncSharedContentDocument,
  type SharedContentSyncResult,
} from "../config/sharedContentApi";
import {
  createSharedContentTransferFile,
  importSharedContentTransferFile,
} from "../config/sharedContentTransfer";

function hasProjectCoverCustomization(
  project: ProjectItem,
  overrides: ReturnType<typeof getImageOverrides>,
) {
  return Boolean(
    (project.image && project.image.trim()) ||
      (project.imageSlot && overrides[project.imageSlot]),
  );
}

function hasProjectCustomContent(
  project: ProjectItem,
  overrides: ReturnType<typeof getImageOverrides>,
) {
  return Boolean(
    hasProjectCoverCustomization(project, overrides) ||
      project.background.trim() ||
      getProjectBackgroundAttachments(project).length > 0 ||
      project.designImages.length > 0 ||
      hasProjectPrototype(project),
  );
}

function hasExperienceContent(experience: ExperienceItem) {
  return Boolean(
    experience.company.trim() ||
      experience.role.trim() ||
      experience.period.trim() ||
      experience.description.trim(),
  );
}

const PROJECT_MEDIA_DISPLAY_MODE_OPTIONS: Array<{
  icon: typeof Monitor;
  label: string;
  value: ProjectMediaDisplayMode;
}> = [
  {
    icon: Monitor,
    label: "PC",
    value: "desktop",
  },
  {
    icon: Smartphone,
    label: "移动",
    value: "mobile",
  },
];

function isSupportedDesignMedia(file: File) {
  return file.type.startsWith("image/") || file.type.startsWith("video/");
}

function isSupportedPrototypeHtml(file: File) {
  return (
    file.type === "text/html" ||
    /\.html?$/i.test(file.name)
  );
}

type PrototypePackageInputFile = File & {
  webkitRelativePath?: string;
};

const PROTOTYPE_UPLOAD_RETRY_DELAYS = [300, 900, 1800];

function normalizePrototypePath(path: string) {
  return path
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/{2,}/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");
}

function getPrototypePackageRelativePath(file: File) {
  const relativePath =
    (file as PrototypePackageInputFile).webkitRelativePath || file.name;
  return normalizePrototypePath(relativePath);
}

function wait(duration: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

async function storePrototypePackageFile(file: File) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= PROTOTYPE_UPLOAD_RETRY_DELAYS.length; attempt += 1) {
    try {
      return await storeMediaFile(file);
    } catch (error) {
      lastError = error;
    }

    if (attempt < PROTOTYPE_UPLOAD_RETRY_DELAYS.length) {
      await wait(PROTOTYPE_UPLOAD_RETRY_DELAYS[attempt]);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("PROTOTYPE_MEDIA_UPLOAD_FAILED");
}

async function uploadPrototypePackageFiles(
  files: Array<{ file: File; path: string }>,
) {
  const uploadedFiles: Array<{
    mimeType?: string;
    path: string;
    src: string;
  }> = [];

  for (const [index, { file, path }] of files.entries()) {
    uploadedFiles.push({
      path,
      src: await storePrototypePackageFile(file),
      mimeType: file.type || undefined,
    });

    if (index < files.length - 1) {
      await wait(80);
    }
  }

  return uploadedFiles;
}

function stripPrototypePackageRoot(
  files: Array<{ file: File; path: string }>,
) {
  const firstSegments = files
    .map(({ path }) => path.split("/"))
    .filter((segments) => segments.length > 1)
    .map((segments) => segments[0]);

  if (
    firstSegments.length !== files.length ||
    new Set(firstSegments).size !== 1
  ) {
    return {
      packageName: "prototype-package",
      files,
    };
  }

  const packageName = firstSegments[0];
  return {
    packageName,
    files: files.map(({ file, path }) => ({
      file,
      path: path.split("/").slice(1).join("/"),
    })),
  };
}

function pickPrototypePackageEntryPath(paths: string[]) {
  const htmlPaths = paths.filter((path) => /\.html?$/i.test(path));
  if (htmlPaths.length === 0) return null;

  return [...htmlPaths].sort((leftPath, rightPath) => {
    const leftFileName = leftPath.split("/").pop()?.toLowerCase() || "";
    const rightFileName = rightPath.split("/").pop()?.toLowerCase() || "";
    const leftIsIndex = leftFileName === "index.html" || leftFileName === "index.htm";
    const rightIsIndex =
      rightFileName === "index.html" || rightFileName === "index.htm";

    if (leftIsIndex !== rightIsIndex) {
      return leftIsIndex ? -1 : 1;
    }

    const depthDifference =
      leftPath.split("/").length - rightPath.split("/").length;
    if (depthDifference !== 0) return depthDifference;

    return leftPath.localeCompare(rightPath, "zh-Hans-CN");
  })[0];
}

function DisplayModeToggle({
  currentMode,
  label,
  onChange,
}: {
  currentMode: ProjectMediaDisplayMode;
  label: string;
  onChange: (displayMode: ProjectMediaDisplayMode) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-[#86868b]">
        {label}
      </p>
      <div className="inline-flex rounded-full border border-[#d2d2d7] bg-white p-1">
        {PROJECT_MEDIA_DISPLAY_MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = currentMode === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[#1d1d1f] text-white"
                  : "text-[#86868b] hover:text-[#1d1d1f]"
              }`}
            >
              <Icon size={13} />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function shouldDeleteMediaAfterSync(
  src: string | null | undefined,
  syncResult: SharedContentSyncResult,
) {
  if (!src) return false;

  if (isRemoteMediaReference(src)) {
    return syncResult.status === "synced";
  }

  return syncResult.status !== "failed" && syncResult.status !== "unauthorized";
}

function getMediaUploadErrorMessage(error: unknown, fallbackMessage: string) {
  const errorMessage = error instanceof Error ? error.message : "";

  if (errorMessage.includes("REMOTE_MEDIA_UNAUTHORIZED")) {
    return "线上媒体上传鉴权失败，请重新进入内容设置后重试。";
  }

  if (
    errorMessage.includes("REMOTE_MEDIA_UPLOAD_FAILED") ||
    errorMessage.includes("REMOTE_MEDIA_CHUNK_UPLOAD_FAILED") ||
    errorMessage.includes("REMOTE_MEDIA_COMPLETE_FAILED") ||
    errorMessage.includes("REMOTE_MEDIA_HTTP_")
  ) {
    return "线上媒体上传失败，请稍后重试；如果仍失败，请查看 Netlify 的 shared-content-media 函数日志。";
  }

  return fallbackMessage;
}

export function ImageSettings() {
  const [overrides, setOverrides] = useState(() => getImageOverrides());
  const [personalInfoSettings, setPersonalInfoSettings] = useState<PersonalInfoSettings>(() =>
    getPersonalInfoSettings(),
  );
  const [projects, setProjects] = useState<ProjectItem[]>(() => getProjects());
  const [experiences, setExperiences] = useState<ExperienceItem[]>(() => getExperiences());
  const [activeTarget, setActiveTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState(() => getSharedContentMode());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState(() =>
    getSharedContentMode() === "remote"
      ? "已连接 Netlify 共享存储，发布后所有访问者会看到同一份内容。"
      : "当前为浏览器本地模式。部署到 Netlify 后会自动切换为共享模式。",
  );
  const deferredSyncTimerRef = useRef<number | null>(null);
  const importTransferInputRef = useRef<HTMLInputElement | null>(null);
  const heroImageSrc = getImageSrc("heroPortrait");

  const configuredProjectsCount = useMemo(
    () =>
      projects.filter((project) => hasProjectCustomContent(project, overrides)).length,
    [overrides, projects],
  );
  const configuredExperiencesCount = useMemo(
    () => experiences.filter((experience) => hasExperienceContent(experience)).length,
    [experiences],
  );

  const refreshOverrides = () => {
    setOverrides(getImageOverrides());
  };

  useEffect(() => {
    return () => {
      if (deferredSyncTimerRef.current) {
        window.clearTimeout(deferredSyncTimerRef.current);
      }
    };
  }, []);

  const applySyncResult = (syncResult: SharedContentSyncResult) => {
    const nextStorageMode = getSharedContentMode();
    setStorageMode(nextStorageMode);
    setIsSyncing(false);

    if (syncResult.status === "synced") {
      setError(null);
      setSyncNotice("已同步到 Netlify 共享存储。");
      return;
    }

    if (syncResult.status === "local-only") {
      setSyncNotice(
        "当前为浏览器本地模式。部署到 Netlify 后会自动切换为共享模式。",
      );
      return;
    }

    if (syncResult.status === "unauthorized") {
      revokeImageSettingsAccess();
    }

    setSyncNotice(
      nextStorageMode === "remote"
        ? "在线存储同步失败，当前变更暂时只保留在当前浏览器。"
        : "当前为浏览器本地模式，修改仅保留在当前浏览器。",
    );

    if (syncResult.message) {
      setError(syncResult.message);
    }
  };

  const syncSharedContentNow = async () => {
    if (deferredSyncTimerRef.current) {
      window.clearTimeout(deferredSyncTimerRef.current);
      deferredSyncTimerRef.current = null;
    }

    setIsSyncing(true);
    const syncResult = await syncSharedContentDocument();
    applySyncResult(syncResult);
    return syncResult;
  };

  const queueSharedContentSync = () => {
    if (
      getSharedContentMode() !== "remote" &&
      !hasRemoteSharedContentService()
    ) {
      setStorageMode("local");
      setSyncNotice(
        "当前为浏览器本地模式。部署到 Netlify 后会自动切换为共享模式。",
      );
      return;
    }

    if (deferredSyncTimerRef.current) {
      window.clearTimeout(deferredSyncTimerRef.current);
    }

    setIsSyncing(true);
    setSyncNotice("正在同步到在线存储...");
    deferredSyncTimerRef.current = window.setTimeout(() => {
      deferredSyncTimerRef.current = null;
      void syncSharedContentNow();
    }, 600);
  };

  const persistProjects = (nextProjects: ProjectItem[]) => {
    setError(null);

    try {
      saveProjects(nextProjects);
      setProjects(nextProjects);
      return true;
    } catch {
      setError("内容保存失败，请重试。");
      return false;
    }
  };

  const persistExperiences = (nextExperiences: ExperienceItem[]) => {
    setError(null);

    try {
      saveExperiences(nextExperiences);
      setExperiences(nextExperiences);
      return true;
    } catch {
      setError("工作经历保存失败，请重试。");
      return false;
    }
  };

  const persistPersonalInfoSettings = (
    nextPersonalInfoSettings: PersonalInfoSettings,
  ) => {
    setError(null);

    try {
      savePersonalInfoSettings(nextPersonalInfoSettings);
      setPersonalInfoSettings(nextPersonalInfoSettings);
      queueSharedContentSync();
      return true;
    } catch {
      setError("个人信息保存失败，请重试。");
      return false;
    }
  };

  const updateProject = (
    projectId: string,
    updater: (project: ProjectItem) => ProjectItem,
  ) => {
    const nextProjects = projects.map((project) =>
      project.id === projectId ? updater(project) : project,
    );

    const saved = persistProjects(nextProjects);
    if (saved) {
      queueSharedContentSync();
    }

    return saved;
  };

  const updateExperience = (
    experienceId: string,
    updater: (experience: ExperienceItem) => ExperienceItem,
  ) => {
    const nextExperiences = experiences.map((experience) =>
      experience.id === experienceId ? updater(experience) : experience,
    );

    const saved = persistExperiences(nextExperiences);
    if (saved) {
      queueSharedContentSync();
    }

    return saved;
  };

  const handleHeroUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setActiveTarget("hero");

    try {
      const previousHeroSrc = overrides.heroPortrait;
      const imageRef = await storeMediaFile(file);

      try {
        setImageOverride("heroPortrait", imageRef);
      } catch {
        await deleteStoredMedia(imageRef);
        throw new Error("Failed to save image override");
      }

      refreshOverrides();
      const syncResult = await syncSharedContentNow();

      if (shouldDeleteMediaAfterSync(previousHeroSrc, syncResult)) {
        await deleteStoredMedia(previousHeroSrc);
      }
    } catch {
      setError("图片保存失败，请重试。");
    } finally {
      setActiveTarget(null);
      event.target.value = "";
    }
  };

  const handleProjectCoverUpload = async (
    projectId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setActiveTarget(`cover-${projectId}`);

    try {
      const currentProject = projects.find((project) => project.id === projectId);
      const previousCoverSrc = currentProject?.image;
      const imageRef = await storeMediaFile(file);
      const nextProjects = projects.map((project) =>
        project.id === projectId ? { ...project, image: imageRef } : project,
      );
      const saved = persistProjects(nextProjects);

      if (!saved) {
        await deleteStoredMedia(imageRef);
        return;
      }

      const syncResult = await syncSharedContentNow();

      if (shouldDeleteMediaAfterSync(previousCoverSrc, syncResult)) {
        await deleteStoredMedia(previousCoverSrc);
      }
    } catch {
      setError("图片保存失败，请重试。");
    } finally {
      setActiveTarget(null);
      event.target.value = "";
    }
  };

  const handleProjectCoverDisplayModeChange = (
    projectId: string,
    imageDisplayMode: ProjectMediaDisplayMode,
  ) => {
    updateProject(projectId, (project) => ({
      ...project,
      imageDisplayMode,
    }));
  };

  const handleProjectDesignUpload = async (
    projectId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    if (!files.every(isSupportedDesignMedia)) {
      setError("仅支持上传图片或视频文件。");
      event.target.value = "";
      return;
    }

    setError(null);
    setActiveTarget(`design-${projectId}`);

    try {
      const mediaRefs = await Promise.all(files.map((file) => storeMediaFile(file)));
      const nextProjects = projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              designImages: [...project.designImages, ...mediaRefs],
              designImageDisplayModes: [
                ...(project.designImageDisplayModes ?? []),
                ...mediaRefs.map(() => "desktop" as const),
              ],
            }
          : project,
      );
      const saved = persistProjects(nextProjects);

      if (!saved) {
        await deleteStoredMediaBatch(mediaRefs);
        return;
      }

      const syncResult = await syncSharedContentNow();
      if (syncResult.status === "failed" || syncResult.status === "unauthorized") {
        return;
      }
    } catch {
      setError("设计素材保存失败，请重试。");
    } finally {
      setActiveTarget(null);
      event.target.value = "";
    }
  };

  const handleResetHero = async () => {
    const previousHeroSrc = await clearImageOverride("heroPortrait");
    refreshOverrides();
    const syncResult = await syncSharedContentNow();

    if (shouldDeleteMediaAfterSync(previousHeroSrc, syncResult)) {
      await deleteStoredMedia(previousHeroSrc);
    }
  };

  const handleResetProjectCover = async (project: ProjectItem) => {
    const previousCoverSrc = project.image;
    const nextProjects = projects.map((currentProject) =>
      currentProject.id === project.id
        ? { ...currentProject, image: undefined }
        : currentProject,
    );
    const saved = persistProjects(nextProjects);

    if (!saved) return;

    const previousSlotOverride = project.imageSlot
      ? await clearImageOverride(project.imageSlot)
      : null;
    if (project.imageSlot) {
      refreshOverrides();
    }

    const syncResult = await syncSharedContentNow();

    if (shouldDeleteMediaAfterSync(previousCoverSrc, syncResult)) {
      await deleteStoredMedia(previousCoverSrc);
    }

    if (shouldDeleteMediaAfterSync(previousSlotOverride, syncResult)) {
      await deleteStoredMedia(previousSlotOverride);
    }
  };

  const handleToggleShowOnHome = (projectId: string) => {
    updateProject(projectId, (project) => ({
      ...project,
      showOnHome: !project.showOnHome,
    }));
  };

  const handleProjectBackgroundChange = (projectId: string, background: string) => {
    updateProject(projectId, (project) => ({
      ...project,
      background,
    }));
  };

  const handleProjectBackgroundAttachmentsUpload = async (
    projectId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setError(null);
    setActiveTarget(`background-attachments-${projectId}`);

    try {
      const attachments = await Promise.all(
        files.map(async (file) => ({
          name: file.name,
          src: await storeMediaFile(file),
          mimeType: file.type || undefined,
        })),
      );
      const nextProjects = projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              backgroundAttachments: [
                ...getProjectBackgroundAttachments(project),
                ...attachments,
              ],
            }
          : project,
      );
      const saved = persistProjects(nextProjects);

      if (!saved) {
        await deleteStoredMediaBatch(
          attachments.map((attachment) => attachment.src),
        );
        return;
      }

      await syncSharedContentNow();
    } catch {
      setError("背景附件保存失败，请重试。");
    } finally {
      setActiveTarget(null);
      event.target.value = "";
    }
  };

  const handleProjectTitleChange = (projectId: string, title: string) => {
    updateProject(projectId, (project) => ({
      ...project,
      title,
    }));
  };

  const handleProjectCategoryChange = (projectId: string, category: string) => {
    updateProject(projectId, (project) => ({
      ...project,
      category,
    }));
  };

  const handleProjectDescriptionChange = (projectId: string, description: string) => {
    updateProject(projectId, (project) => ({
      ...project,
      description,
    }));
  };

  const handleProjectPrototypeEntryChange = (
    projectId: string,
    prototypeEntryPath: string,
  ) => {
    updateProject(projectId, (project) => ({
      ...project,
      prototypeEntryPath,
    }));
  };

  const handleOpenProjectPrototype = async (project: ProjectItem) => {
    setError(null);

    const result = await openProjectPrototypeWindow(project);
    if (result === "popup_blocked") {
      setError("浏览器拦截了新窗口，请允许当前站点打开新窗口后重试。");
      return;
    }

    if (result === "unavailable") {
      setError("当前 HTML 原型暂时无法打开，请刷新后重试或重新上传导出包。");
    }
  };

  const handleProjectPrototypeUpload = async (
    projectId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (selectedFiles.length === 0) return;

    const normalizedPackageFiles = stripPrototypePackageRoot(
      selectedFiles
        .map((file) => ({
          file,
          path: getPrototypePackageRelativePath(file),
        }))
        .filter(({ path }) => Boolean(path)),
    );

    const entryPath = pickPrototypePackageEntryPath(
      normalizedPackageFiles.files.map(({ path }) => path),
    );

    if (!entryPath) {
      setError("导出包中未找到可用的 .html 入口文件。");
      event.target.value = "";
      return;
    }

    setError(null);
    setActiveTarget(`prototype-${projectId}`);

    try {
      const currentProject = projects.find((project) => project.id === projectId);
      const previousPrototypeSources = [
        currentProject?.prototypeBundle,
        currentProject?.prototypeHtml,
        ...(currentProject?.prototypeFiles?.map((prototypeFile) => prototypeFile.src) ?? []),
      ];
      const prototypeFiles = await uploadPrototypePackageFiles(
        normalizedPackageFiles.files,
      );
      const nextProjects = projects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              prototypeBundle: undefined,
              prototypeHtml: undefined,
              prototypeHtmlPaths: undefined,
              prototypeEntryPath: entryPath,
              prototypeFiles,
              prototypeName: normalizedPackageFiles.packageName,
            }
          : project,
      );
      const saved = persistProjects(nextProjects);

      if (!saved) {
        await deleteStoredMediaBatch(
          prototypeFiles.map((prototypeFile) => prototypeFile.src),
        );
        return;
      }

      const syncResult = await syncSharedContentNow();
      if (syncResult.status === "synced") {
        await deleteStoredMediaBatch(previousPrototypeSources);
      }
    } catch (error) {
      setError(
        getMediaUploadErrorMessage(
          error,
          "导出包保存失败，请重试；如果导出包资源较多，请等待当前上传结束后再次尝试。",
        ),
      );
    } finally {
      setActiveTarget(null);
      event.target.value = "";
    }
  };

  const handleClearProjectPrototype = async (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project || !hasProjectPrototype(project)) return;

    const previousPrototypeSources = [
      project.prototypeBundle,
      project.prototypeHtml,
      ...(project.prototypeFiles?.map((prototypeFile) => prototypeFile.src) ?? []),
    ];
    const saved = updateProject(projectId, (project) => ({
      ...project,
      prototypeBundle: undefined,
      prototypeHtml: undefined,
      prototypeHtmlPaths: undefined,
      prototypeName: undefined,
      prototypeEntryPath: undefined,
      prototypeFiles: undefined,
    }));

    if (!saved) return;

    const syncResult = await syncSharedContentNow();
    if (syncResult.status === "synced") {
      await deleteStoredMediaBatch(previousPrototypeSources);
    }
  };

  const handleClearProjectBackground = (projectId: string) => {
    updateProject(projectId, (project) => ({
      ...project,
      background: "",
    }));
  };

  const handleRemoveProjectBackgroundAttachment = async (
    projectId: string,
    attachmentIndex: number,
  ) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;

    const previousAttachmentSrc =
      getProjectBackgroundAttachments(project)[attachmentIndex]?.src;
    const saved = updateProject(projectId, (currentProject) => ({
      ...currentProject,
      backgroundAttachments: getProjectBackgroundAttachments(currentProject).filter(
        (_, index) => index !== attachmentIndex,
      ),
    }));

    if (!saved) return;

    const syncResult = await syncSharedContentNow();
    if (shouldDeleteMediaAfterSync(previousAttachmentSrc, syncResult)) {
      await deleteStoredMedia(previousAttachmentSrc);
    }
  };

  const handleClearProjectBackgroundAttachments = async (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;

    const previousAttachmentSources = getProjectBackgroundAttachments(project).map(
      (attachment) => attachment.src,
    );
    const saved = updateProject(projectId, (currentProject) => ({
      ...currentProject,
      backgroundAttachments: [],
    }));

    if (!saved) return;

    const syncResult = await syncSharedContentNow();
    if (syncResult.status === "synced" || syncResult.status === "local-only") {
      await deleteStoredMediaBatch(previousAttachmentSources);
    }
  };

  const handleProjectDesignMediaDisplayModeChange = (
    projectId: string,
    imageIndex: number,
    displayMode: ProjectMediaDisplayMode,
  ) => {
    updateProject(projectId, (project) => ({
      ...project,
      designImageDisplayModes: project.designImages.map((_, index) =>
        index === imageIndex
          ? displayMode
          : getProjectDesignMediaDisplayMode(project, index),
      ),
    }));
  };

  const handleRemoveDesignImage = async (projectId: string, imageIndex: number) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;

    const previousMediaSrc = project.designImages[imageIndex];
    const saved = updateProject(projectId, (project) => ({
      ...project,
      designImages: project.designImages.filter((_, index) => index !== imageIndex),
      designImageDisplayModes: project.designImages
        .filter((_, index) => index !== imageIndex)
        .map((_, nextIndex) =>
          getProjectDesignMediaDisplayMode(
            project,
            nextIndex >= imageIndex ? nextIndex + 1 : nextIndex,
          ),
        ),
    }));

    if (!saved) return;

    const syncResult = await syncSharedContentNow();
    if (shouldDeleteMediaAfterSync(previousMediaSrc, syncResult)) {
      await deleteStoredMedia(previousMediaSrc);
    }
  };

  const handleClearDesignImages = async (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;

    const previousMediaSources = [...project.designImages];
    const saved = updateProject(projectId, (project) => ({
      ...project,
      designImages: [],
      designImageDisplayModes: [],
    }));

    if (!saved) return;

    const syncResult = await syncSharedContentNow();
    if (syncResult.status === "synced" || syncResult.status === "local-only") {
      await deleteStoredMediaBatch(previousMediaSources);
    }
  };

  const handleAddProject = () => {
    const blankProject = createBlankProject(projects.length);
    const saved = persistProjects([...projects, blankProject]);
    if (saved) {
      queueSharedContentSync();
    }
  };

  const handleDeleteProject = async (project: ProjectItem) => {
    const shouldDelete = window.confirm(
      `确定删除项目“${project.title || "未命名项目"}”吗？该操作会移除封面、项目背景、背景附件、设计素材和 HTML 导出包，且无法恢复。`,
    );
    if (!shouldDelete) return;

    setActiveTarget((currentTarget) =>
      currentTarget?.includes(project.id) ? null : currentTarget,
    );

    const nextProjects = projects.filter(
      (currentProject) => currentProject.id !== project.id,
    );
    const saved = persistProjects(nextProjects);
    if (!saved) return;

    const syncResult = await syncSharedContentNow();
    if (syncResult.status === "synced" || syncResult.status === "local-only") {
      await deleteStoredMediaBatch([
        project.image,
        project.prototypeBundle,
        project.prototypeHtml,
        ...getProjectBackgroundAttachments(project).map((attachment) => attachment.src),
        ...(project.prototypeFiles?.map((prototypeFile) => prototypeFile.src) ?? []),
        ...project.designImages,
      ]);
    }
  };

  const handleResetAllImages = async () => {
    const projectMediaSources = projects.flatMap((project) => [
      project.image,
      ...project.designImages,
    ]);
    const nextProjects = projects.map((project) => ({
      ...project,
      image: undefined,
      designImages: [],
      designImageDisplayModes: [],
    }));

    const saved = persistProjects(nextProjects);
    if (!saved) return;

    const previousOverrideSources = await clearAllImageOverrides();
    refreshOverrides();
    const syncResult = await syncSharedContentNow();

    if (syncResult.status === "synced" || syncResult.status === "local-only") {
      await deleteStoredMediaBatch(projectMediaSources);
      await deleteStoredMediaBatch(previousOverrideSources);
    }
  };

  const handleAddExperience = () => {
    const blankExperience = createBlankExperience(experiences.length);
    const saved = persistExperiences([...experiences, blankExperience]);
    if (saved) {
      queueSharedContentSync();
    }
  };

  const handleDeleteExperience = (experience: ExperienceItem) => {
    const shouldDelete = window.confirm(
      `确定删除这条工作经历吗？删除后无法恢复。`,
    );
    if (!shouldDelete) return;

    const nextExperiences = experiences.filter(
      (currentExperience) => currentExperience.id !== experience.id,
    );
    const saved = persistExperiences(nextExperiences);
    if (saved) {
      queueSharedContentSync();
    }
  };

  const handleExportTransferPackage = async () => {
    setError(null);
    setActiveTarget("transfer-export");

    try {
      const transferFile = await createSharedContentTransferFile();
      const downloadUrl = URL.createObjectURL(transferFile);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = transferFile.name;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);
    } catch {
      setError("内容包导出失败，请重试。");
    } finally {
      setActiveTarget(null);
    }
  };

  const handleImportTransferPackage = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const confirmed = window.confirm(
      "导入内容包会用文件中的内容覆盖当前站点设置，是否继续？",
    );
    if (!confirmed) {
      event.target.value = "";
      return;
    }

    setError(null);
    setActiveTarget("transfer-import");

    try {
      const importedContent = await importSharedContentTransferFile(file);
      setProjects(importedContent.projects);
      setExperiences(importedContent.experiences);
      setPersonalInfoSettings(importedContent.personalInfo);
      setOverrides(importedContent.imageOverrides);
      await syncSharedContentNow();
    } catch {
      setError("内容包导入失败，请检查文件后重试。");
    } finally {
      setActiveTarget(null);
      event.target.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f] pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-8 md:px-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[#86868b] hover:text-[#1d1d1f] transition-colors mb-10 font-medium group"
        >
          <ArrowLeft
            size={16}
            className="group-hover:-translate-x-1 transition-transform"
          />
          返回首页
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            内容设置
          </h1>
          <p className="text-xl text-[#86868b] max-w-3xl">
            {storageMode === "remote"
              ? "统一维护项目、首页图片和工作经历。当前修改会同步到 Netlify 在线存储，所有访问者看到的是同一份内容。"
              : "统一维护项目、首页图片和工作经历。当前仍是浏览器本地模式，部署到 Netlify 后会自动切换为共享模式。"}
          </p>
        </motion.div>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="text-sm text-[#86868b]">
            <p>
              已配置项目内容:{" "}
              <span className="text-[#1d1d1f] font-semibold">
                {configuredProjectsCount}
              </span>{" "}
              / {projects.length}
            </p>
            <p className="mt-1">
              已配置工作经历:{" "}
              <span className="text-[#1d1d1f] font-semibold">
                {configuredExperiencesCount}
              </span>{" "}
              / {experiences.length}
            </p>
            <p className="mt-1 text-xs text-[#a0a0a5]">
              项目背景会展示在详情页，重置全部图片会清空封面和设计素材，工作经历单独维护。
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs text-[#55565c] shadow-sm">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  storageMode === "remote" ? "bg-[#4b7f56]" : "bg-[#a0a0a5]"
                }`}
              />
              <span className="font-medium">
                {storageMode === "remote" ? "Netlify 共享模式" : "浏览器本地模式"}
              </span>
              <span className="text-[#86868b]">
                {isSyncing ? "正在同步..." : syncNotice}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#a0a0a5]">
              迁移到线上时，可先在本地导出内容包，再到 Netlify 站点导入。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleExportTransferPackage()}
              disabled={activeTarget === "transfer-export"}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#d2d2d7] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors disabled:opacity-50"
            >
              <Download size={16} />
              {activeTarget === "transfer-export" ? "导出中..." : "导出内容包"}
            </button>
            <div>
              <input
                ref={importTransferInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => void handleImportTransferPackage(event)}
              />
              <button
                type="button"
                onClick={() => importTransferInputRef.current?.click()}
                disabled={activeTarget === "transfer-import"}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#d2d2d7] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors disabled:opacity-50"
              >
                <Upload size={16} />
                {activeTarget === "transfer-import" ? "导入中..." : "导入内容包"}
              </button>
            </div>
            <button
              onClick={handleAddExperience}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#d2d2d7] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
            >
              <Briefcase size={16} />
              新增工作经历
            </button>
            <button
              onClick={handleAddProject}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1d1d1f] text-white hover:bg-[#333336] transition-colors"
            >
              <Plus size={16} />
              新增项目
            </button>
            <button
              onClick={handleResetAllImages}
              disabled={
                !overrides.heroPortrait &&
                projects.every(
                  (project) =>
                    !hasProjectCoverCustomization(project, overrides) &&
                    project.designImages.length === 0,
                )
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#d2d2d7] text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors disabled:opacity-50"
            >
              <RotateCcw size={16} />
              重置全部图片
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-8 rounded-2xl bg-red-50 border border-red-100 text-red-600 px-5 py-4 text-sm">
            {error}
          </div>
        )}

        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-[28px] bg-[#f5f5f7] p-6 md:p-7 shadow-[0_20px_40px_rgba(0,0,0,0.04)] mb-8"
        >
          <div className="aspect-[4/3] md:aspect-[12/4] rounded-[18px] overflow-hidden bg-white mb-5">
            {heroImageSrc ? (
              <img
                src={heroImageSrc}
                alt="首页主视觉图片"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#a0a0a5]">
                正在加载图片
              </div>
            )}
          </div>

          <div className="mb-5">
            <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">首页主视觉图片</h2>
            <p className="text-sm text-[#86868b] mb-1">Hero 区域右侧展示图</p>
            <p className="text-xs text-[#a0a0a5]">使用位置: 首页</p>
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1d1d1f] text-white rounded-full text-sm font-medium cursor-pointer hover:bg-[#333336] transition-colors">
              <ImagePlus size={16} />
              {activeTarget === "hero" ? "保存中..." : "替换图片"}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(event) => void handleHeroUpload(event)}
              />
            </label>
            <button
              onClick={handleResetHero}
              disabled={!overrides.heroPortrait}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#d2d2d7] text-sm text-[#1d1d1f] hover:bg-white transition-colors disabled:opacity-50"
            >
              <RotateCcw size={15} />
              恢复默认
            </button>
          </div>

          <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-[#4b7f56] bg-[#e9f7ee] px-3 py-1.5 rounded-full">
            <Check size={12} />
            {overrides.heroPortrait ? "已使用自定义图片" : "当前为默认图片"}
          </div>
        </motion.article>

        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.04 }}
          className="rounded-[28px] bg-[#f5f5f7] p-6 md:p-7 shadow-[0_20px_40px_rgba(0,0,0,0.04)] mb-8"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-[#1d1d1f]">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#1d1d1f] mb-1">
                个人信息设置
              </h2>
              <p className="text-sm text-[#86868b]">
                这里维护首页“关于我”模块中的个人信息展示，电话和邮箱也会同步到“联系我”弹窗。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#86868b]">
                性别
              </span>
              <input
                value={personalInfoSettings.gender}
                onChange={(event) =>
                  persistPersonalInfoSettings({
                    ...personalInfoSettings,
                    gender: event.target.value,
                  })
                }
                placeholder="例如：男"
                className="w-full rounded-[18px] border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f] transition-colors"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#86868b]">
                年龄
              </span>
              <input
                value={personalInfoSettings.age}
                onChange={(event) =>
                  persistPersonalInfoSettings({
                    ...personalInfoSettings,
                    age: event.target.value,
                  })
                }
                placeholder="例如：24岁"
                className="w-full rounded-[18px] border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f] transition-colors"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#86868b]">
                工作经验
              </span>
              <input
                value={personalInfoSettings.workExperience}
                onChange={(event) =>
                  persistPersonalInfoSettings({
                    ...personalInfoSettings,
                    workExperience: event.target.value,
                  })
                }
                placeholder="例如：3年（含实习）"
                className="w-full rounded-[18px] border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f] transition-colors"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#86868b]">
                学历
              </span>
              <input
                value={personalInfoSettings.education}
                onChange={(event) =>
                  persistPersonalInfoSettings({
                    ...personalInfoSettings,
                    education: event.target.value,
                  })
                }
                placeholder="例如：本科"
                className="w-full rounded-[18px] border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f] transition-colors"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#86868b]">
                学校
              </span>
              <input
                value={personalInfoSettings.school}
                onChange={(event) =>
                  persistPersonalInfoSettings({
                    ...personalInfoSettings,
                    school: event.target.value,
                  })
                }
                placeholder="例如：山西应用科技学院"
                className="w-full rounded-[18px] border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f] transition-colors"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#86868b]">
                专业
              </span>
              <input
                value={personalInfoSettings.major}
                onChange={(event) =>
                  persistPersonalInfoSettings({
                    ...personalInfoSettings,
                    major: event.target.value,
                  })
                }
                placeholder="例如：数字媒体艺术"
                className="w-full rounded-[18px] border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f] transition-colors"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#86868b]">
                现居住地
              </span>
              <input
                value={personalInfoSettings.currentLocation}
                onChange={(event) =>
                  persistPersonalInfoSettings({
                    ...personalInfoSettings,
                    currentLocation: event.target.value,
                  })
                }
                placeholder="例如：北京"
                className="w-full rounded-[18px] border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f] transition-colors"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#86868b]">
                电话
              </span>
              <input
                value={personalInfoSettings.phone}
                onChange={(event) =>
                  persistPersonalInfoSettings({
                    ...personalInfoSettings,
                    phone: event.target.value,
                  })
                }
                placeholder="例如：17794764416"
                className="w-full rounded-[18px] border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f] transition-colors"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#86868b]">
                邮箱
              </span>
              <input
                value={personalInfoSettings.email}
                onChange={(event) =>
                  persistPersonalInfoSettings({
                    ...personalInfoSettings,
                    email: event.target.value,
                  })
                }
                placeholder="例如：name@example.com"
                className="w-full rounded-[18px] border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f] transition-colors"
              />
            </label>
          </div>

          <p className="mt-3 text-xs text-[#a0a0a5]">
            {storageMode === "remote"
              ? "输入后会自动同步到在线存储"
              : "输入时自动保存到当前浏览器"}
          </p>
        </motion.article>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {projects.map((project) => {
            const imageSrc = getProjectImageSrc(project);
            const imageDisplayMode = getProjectImageDisplayMode(project);
            const isCoverCustomized = hasProjectCoverCustomization(project, overrides);
            const hasBackground = Boolean(project.background.trim());
            const backgroundAttachments = getProjectBackgroundAttachments(project);
            const backgroundAttachmentCount = backgroundAttachments.length;
            const designMediaCount = project.designImages.length;
            const prototypeEntryCandidates = getProjectPrototypeEntryCandidates(project);
            const activeCoverTarget = activeTarget === `cover-${project.id}`;
            const activeBackgroundAttachmentTarget =
              activeTarget === `background-attachments-${project.id}`;
            const activeDesignTarget = activeTarget === `design-${project.id}`;

            return (
              <motion.article
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="rounded-[28px] bg-[#f5f5f7] p-6 md:p-7 shadow-[0_20px_40px_rgba(0,0,0,0.04)]"
              >
                <div className="mb-5">
                  <ProjectMediaFrame
                    displayMode={imageDisplayMode}
                    showDisplayBadge
                    className="bg-white"
                  >
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={project.title || "项目图片"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#a0a0a5]">
                      空白项目图片
                    </div>
                  )}
                  </ProjectMediaFrame>
                </div>

                <div className="mb-5">
                  <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">
                    {project.title || "（空白项目）"}
                  </h2>
                  <p className="text-sm text-[#86868b] mb-1">
                    {project.category || "未分类项目"}
                  </p>
                  <p className="text-xs text-[#a0a0a5]">
                    首页状态: {project.showOnHome ? "显示中" : "未显示"} · 背景:{" "}
                    {hasBackground ? "已填写" : "未填写"} · 背景附件:{" "}
                    {backgroundAttachmentCount} 个 · 封面尺寸:{" "}
                    {getProjectMediaDisplayModeLabel(imageDisplayMode)} · 设计素材: {designMediaCount} 项 · HTML 原型:{" "}
                    {hasProjectPrototype(project) ? "已上传" : "未上传"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1d1d1f] text-white rounded-full text-sm font-medium cursor-pointer hover:bg-[#333336] transition-colors">
                    <ImagePlus size={16} />
                    {activeCoverTarget ? "保存中..." : "替换封面"}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(event) =>
                        void handleProjectCoverUpload(project.id, event)
                      }
                    />
                  </label>
                  <button
                    onClick={() => handleResetProjectCover(project)}
                    disabled={!isCoverCustomized}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#d2d2d7] text-sm text-[#1d1d1f] hover:bg-white transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={15} />
                    恢复封面
                  </button>
                  <button
                    onClick={() => handleToggleShowOnHome(project.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm transition-colors ${
                      project.showOnHome
                        ? "bg-[#1d1d1f] text-white"
                        : "border border-[#d2d2d7] text-[#1d1d1f] hover:bg-white"
                    }`}
                  >
                    {project.showOnHome ? "已显示到主页" : "显示到主页"}
                  </button>
                  <button
                    onClick={() => handleDeleteProject(project)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-red-200 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={15} />
                    删除项目
                  </button>
                </div>

                <div className="mt-4">
                  <DisplayModeToggle
                    currentMode={imageDisplayMode}
                    label="封面显示尺寸"
                    onChange={(displayMode) =>
                      handleProjectCoverDisplayModeChange(
                        project.id,
                        displayMode,
                      )
                    }
                  />
                </div>

                <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-[#4b7f56] bg-[#e9f7ee] px-3 py-1.5 rounded-full">
                  <Check size={12} />
                  {hasProjectCustomContent(project, overrides)
                    ? "该项目已配置详情内容"
                    : "当前仅使用默认封面，背景文字、背景附件、设计素材和 HTML 原型为空"}
                </div>

                <div className="mt-6 pt-6 border-t border-[#e2e2e7]">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-[#1d1d1f]">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#1d1d1f]">
                        项目信息
                      </h3>
                      <p className="text-sm text-[#86868b]">
                        这里维护项目名称、分类和简介，会同步展示到首页、作品列表和详情页。
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[#86868b]">
                        项目名称
                      </span>
                      <input
                        value={project.title}
                        onChange={(event) =>
                          handleProjectTitleChange(project.id, event.target.value)
                        }
                        placeholder="例如：企业资源管理系统（ERP）"
                        className="w-full rounded-[18px] border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f] transition-colors"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[#86868b]">
                        项目分类
                      </span>
                      <input
                        value={project.category}
                        onChange={(event) =>
                          handleProjectCategoryChange(project.id, event.target.value)
                        }
                        placeholder="例如：B端后台系统 / C端小程序"
                        className="w-full rounded-[18px] border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f] transition-colors"
                      />
                    </label>

                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm font-medium text-[#86868b]">
                        项目简介
                      </span>
                      <textarea
                        value={project.description}
                        onChange={(event) =>
                          handleProjectDescriptionChange(project.id, event.target.value)
                        }
                        placeholder="输入项目的定位、你的角色和核心成果，用于首页和作品列表简介展示..."
                        className="w-full min-h-[132px] rounded-[22px] border border-[#d2d2d7] bg-white px-5 py-4 text-[15px] leading-7 outline-none resize-y focus:border-[#1d1d1f] transition-colors"
                      />
                    </label>
                  </div>

                  <p className="mt-3 text-xs text-[#a0a0a5]">
                    {storageMode === "remote"
                      ? "输入后会自动同步到在线存储"
                      : "输入时自动保存到当前浏览器"}
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-[#e2e2e7]">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-[#1d1d1f]">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#1d1d1f]">
                        项目背景
                      </h3>
                      <p className="text-sm text-[#86868b]">
                        这里填写的内容会展示在项目详情页的“项目背景”模块。
                      </p>
                    </div>
                  </div>

                  <textarea
                    value={project.background}
                    onChange={(event) =>
                      handleProjectBackgroundChange(project.id, event.target.value)
                    }
                    placeholder="输入项目背景、业务目标、用户问题、设计角色或关键挑战..."
                    className="w-full min-h-[180px] rounded-[22px] border border-[#d2d2d7] bg-white px-5 py-4 text-[15px] leading-7 outline-none resize-y focus:border-[#1d1d1f] transition-colors"
                  />

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-[#a0a0a5]">
                      {storageMode === "remote"
                        ? "输入后会自动同步到在线存储"
                        : "输入时自动保存到当前浏览器"}
                    </p>
                    <button
                      onClick={() => handleClearProjectBackground(project.id)}
                      disabled={!hasBackground}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#d2d2d7] text-sm text-[#1d1d1f] hover:bg-white transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      清空背景文字
                    </button>
                  </div>

                  <div className="mt-5 rounded-[22px] border border-[#ececf1] bg-white px-5 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#f5f5f7] flex items-center justify-center text-[#1d1d1f]">
                          <Paperclip size={18} />
                        </div>
                        <div>
                          <h4 className="text-base font-semibold text-[#1d1d1f]">
                            背景附件
                          </h4>
                          <p className="text-sm text-[#86868b]">
                            支持补充 PDF、图片、视频或其他附件，详情页会展示附件列表；浏览器支持的文件可直接预览。
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1d1d1f] text-white rounded-full text-sm font-medium cursor-pointer hover:bg-[#333336] transition-colors">
                          <ImagePlus size={16} />
                          {activeBackgroundAttachmentTarget ? "保存中..." : "上传附件"}
                          <input
                            type="file"
                            className="hidden"
                            multiple
                            onChange={(event) =>
                              void handleProjectBackgroundAttachmentsUpload(
                                project.id,
                                event,
                              )
                            }
                          />
                        </label>
                        <button
                          onClick={() =>
                            void handleClearProjectBackgroundAttachments(project.id)
                          }
                          disabled={backgroundAttachmentCount === 0}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#d2d2d7] text-sm text-[#1d1d1f] hover:bg-white transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          清空附件
                        </button>
                      </div>
                    </div>

                    {backgroundAttachmentCount === 0 ? (
                      <div className="rounded-[18px] border border-dashed border-[#d2d2d7] bg-[#fbfbfc] px-4 py-7 text-center text-sm text-[#86868b]">
                        暂无背景附件，请点击“上传附件”添加。
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {backgroundAttachments.map((attachment, index) => {
                          const attachmentSrc = getProjectBackgroundAttachmentSrc(
                            attachment.src,
                          );
                          const canPreview =
                            Boolean(attachmentSrc) &&
                            isProjectBackgroundAttachmentPreviewable(attachment);
                          const attachmentMimeType =
                            getProjectBackgroundAttachmentMimeType(attachment) ||
                            "通用文件";

                          return (
                            <div
                              key={`${project.id}-background-attachment-${index}`}
                              className="flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-[#ececf1] px-4 py-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-[#1d1d1f]">
                                  {attachment.name}
                                </p>
                                <p className="mt-1 text-xs text-[#a0a0a5]">
                                  {attachmentMimeType}
                                  {canPreview ? " · 可预览" : " · 仅下载"}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-3">
                                {canPreview ? (
                                  <a
                                    href={attachmentSrc || undefined}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-sm text-[#1d1d1f] hover:text-black transition-colors"
                                  >
                                    <Eye size={14} />
                                    预览
                                  </a>
                                ) : null}
                                {attachmentSrc ? (
                                  <a
                                    href={attachmentSrc}
                                    download={attachment.name}
                                    className="inline-flex items-center gap-1.5 text-sm text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                                  >
                                    <Download size={14} />
                                    下载
                                  </a>
                                ) : (
                                  <span className="text-sm text-[#a0a0a5]">
                                    正在加载附件
                                  </span>
                                )}
                                <button
                                  onClick={() =>
                                    void handleRemoveProjectBackgroundAttachment(
                                      project.id,
                                      index,
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 size={14} />
                                  删除
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-[#e2e2e7]">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-[#1d1d1f]">
                        <Images size={18} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-[#1d1d1f]">
                          项目设计图 / 视频
                        </h3>
                        <p className="text-sm text-[#86868b]">
                          支持多选上传图片或视频，详情页会按顺序展示所有设计内容。视频建议压缩后再上传。
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1d1d1f] text-white rounded-full text-sm font-medium cursor-pointer hover:bg-[#333336] transition-colors">
                        <ImagePlus size={16} />
                        {activeDesignTarget ? "保存中..." : "上传设计图/视频"}
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          accept="image/*,video/*"
                          onChange={(event) =>
                            void handleProjectDesignUpload(project.id, event)
                          }
                        />
                      </label>
                      <button
                        onClick={() => handleClearDesignImages(project.id)}
                        disabled={designMediaCount === 0}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#d2d2d7] text-sm text-[#1d1d1f] hover:bg-white transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        清空设计素材
                      </button>
                    </div>
                  </div>

                  {designMediaCount === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-[#d2d2d7] bg-white px-5 py-8 text-center text-sm text-[#86868b]">
                      暂无设计素材，请点击“上传设计图/视频”添加。
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {project.designImages.map((imageSrc, index) => {
                        const mediaSrc = getProjectDesignMediaSrc(imageSrc);
                        const displayMode = getProjectDesignMediaDisplayMode(
                          project,
                          index,
                        );
                        const isVideo = isProjectDesignVideo(imageSrc);

                        return (
                          <div
                            key={`${project.id}-design-${index}`}
                            className="relative rounded-[22px] overflow-hidden bg-white border border-[#ececf1]"
                          >
                            <ProjectMediaFrame
                              displayMode={displayMode}
                              showDisplayBadge
                              className="rounded-none"
                            >
                              {!mediaSrc ? (
                                <div className="flex h-full w-full items-center justify-center text-[#a0a0a5]">
                                  正在加载素材
                                </div>
                              ) : isVideo ? (
                                <video
                                  src={mediaSrc}
                                  controls
                                  playsInline
                                  preload="metadata"
                                  className="h-full w-full object-cover bg-black"
                                />
                              ) : (
                                <img
                                  src={mediaSrc}
                                  alt={`${project.title || "项目"}设计图 ${index + 1}`}
                                  className="h-full w-full object-cover"
                                />
                              )}
                            </ProjectMediaFrame>
                            <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                              <div>
                                <span className="text-sm text-[#86868b]">
                                  {isVideo ? "视频" : "设计图"} {index + 1} ·{" "}
                                  {getProjectMediaDisplayModeLabel(displayMode)}
                                </span>
                                <div className="mt-3">
                                  <DisplayModeToggle
                                    currentMode={displayMode}
                                    label="素材显示尺寸"
                                    onChange={(nextDisplayMode) =>
                                      handleProjectDesignMediaDisplayModeChange(
                                        project.id,
                                        index,
                                        nextDisplayMode,
                                      )
                                    }
                                  />
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  void handleRemoveDesignImage(project.id, index)
                                }
                                className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors"
                              >
                                <Trash2 size={14} />
                                删除
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-[#e2e2e7]">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-[#1d1d1f]">
                        <FileText size={18} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-[#1d1d1f]">
                          HTML 导出包
                        </h3>
                        <p className="text-sm text-[#86868b]">
                          请选择导出包所在目录，系统会自动识别入口 HTML，并保留包内的 css、js、图片等资源。
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1d1d1f] text-white rounded-full text-sm font-medium cursor-pointer hover:bg-[#333336] transition-colors">
                        <ImagePlus size={16} />
                        {activeTarget === `prototype-${project.id}` ? "保存中..." : "上传导出包"}
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          ref={(node) => {
                            if (!node) return;
                            node.setAttribute("webkitdirectory", "");
                            node.setAttribute("directory", "");
                          }}
                          onChange={(event) =>
                            void handleProjectPrototypeUpload(project.id, event)
                          }
                        />
                      </label>
                      <button
                        onClick={() => void handleClearProjectPrototype(project.id)}
                        disabled={!hasProjectPrototype(project)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#d2d2d7] text-sm text-[#1d1d1f] hover:bg-white transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                        清空导出包
                      </button>
                    </div>
                  </div>

                  {hasProjectPrototype(project) ? (
                    <div className="rounded-[22px] border border-[#ececf1] bg-white px-5 py-4">
                      <p className="text-sm font-medium text-[#1d1d1f]">
                        已上传导出包
                      </p>
                      <p className="mt-1 text-sm text-[#86868b]">
                        {project.prototypeName || "prototype-package"}
                      </p>
                      {project.prototypeEntryPath ? (
                        <p className="mt-1 text-xs text-[#a0a0a5]">
                          入口文件：{project.prototypeEntryPath}
                        </p>
                      ) : null}
                      {prototypeEntryCandidates.length > 1 ? (
                        <label className="mt-4 block">
                          <span className="mb-2 block text-sm font-medium text-[#86868b]">
                            预览入口页
                          </span>
                          <select
                            value={project.prototypeEntryPath || prototypeEntryCandidates[0]}
                            onChange={(event) =>
                              handleProjectPrototypeEntryChange(
                                project.id,
                                event.target.value,
                              )
                            }
                            className="w-full rounded-[16px] border border-[#d2d2d7] bg-white px-4 py-3 text-sm text-[#1d1d1f] outline-none focus:border-[#1d1d1f] transition-colors"
                          >
                            {prototypeEntryCandidates.map((entryPath) => (
                              <option key={entryPath} value={entryPath}>
                                {entryPath}
                              </option>
                            ))}
                          </select>
                          <p className="mt-2 text-xs text-[#a0a0a5]">
                            如果当前预览打开的是壳页面或错误页面，请在这里切换真正的首页 HTML。
                          </p>
                        </label>
                      ) : null}
                      <button
                        onClick={() => void handleOpenProjectPrototype(project)}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#1d1d1f] hover:text-black"
                      >
                        查看 HTML 原型
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-[#d2d2d7] bg-white px-5 py-8 text-center text-sm text-[#86868b]">
                      暂无 HTML 导出包，请点击“上传导出包”选择原型目录。
                    </div>
                  )}
                </div>
              </motion.article>
            );
          })}
        </div>

        <div className="mt-16">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1d1d1f] mb-3">
              工作经历设置
            </h2>
            <p className="text-lg text-[#86868b] max-w-3xl">
              这里维护首页“工作经历”模块的展示内容，支持新增、编辑和删除，输入后会自动保存。
            </p>
          </motion.div>

          <div className="space-y-6">
            {experiences.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-[#d2d2d7] bg-[#f5f5f7] px-6 py-10 text-center">
                <p className="text-lg font-semibold text-[#1d1d1f]">暂无工作经历</p>
                <p className="mt-2 text-sm text-[#86868b]">
                  点击上方“新增工作经历”开始添加。
                </p>
              </div>
            ) : (
              experiences.map((experience, index) => (
                <motion.article
                  key={experience.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: index * 0.04 }}
                  className="rounded-[28px] bg-[#f5f5f7] p-6 md:p-7 shadow-[0_20px_40px_rgba(0,0,0,0.04)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center text-[#1d1d1f]">
                        <Briefcase size={18} />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-[#1d1d1f]">
                          {experience.company || `工作经历 ${index + 1}`}
                        </h3>
                        <p className="text-sm text-[#86868b]">
                          首页展示顺序会和这里的排列顺序保持一致
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteExperience(experience)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-red-200 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={15} />
                      删除经历
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[#86868b]">
                        公司名称
                      </span>
                      <input
                        value={experience.company}
                        onChange={(event) =>
                          updateExperience(experience.id, (currentExperience) => ({
                            ...currentExperience,
                            company: event.target.value,
                          }))
                        }
                        placeholder="例如：大律云（北京）科技有限公司"
                        className="w-full rounded-[18px] border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f] transition-colors"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-[#86868b]">
                        岗位名称
                      </span>
                      <input
                        value={experience.role}
                        onChange={(event) =>
                          updateExperience(experience.id, (currentExperience) => ({
                            ...currentExperience,
                            role: event.target.value,
                          }))
                        }
                        placeholder="例如：UX交互设计师"
                        className="w-full rounded-[18px] border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f] transition-colors"
                      />
                    </label>

                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm font-medium text-[#86868b]">
                        时间与地点
                      </span>
                      <input
                        value={experience.period}
                        onChange={(event) =>
                          updateExperience(experience.id, (currentExperience) => ({
                            ...currentExperience,
                            period: event.target.value,
                          }))
                        }
                        placeholder="例如：2025.04 - 至今 | 北京"
                        className="w-full rounded-[18px] border border-[#d2d2d7] bg-white px-4 py-3 text-[15px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f] transition-colors"
                      />
                    </label>

                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-sm font-medium text-[#86868b]">
                        工作描述
                      </span>
                      <textarea
                        value={experience.description}
                        onChange={(event) =>
                          updateExperience(experience.id, (currentExperience) => ({
                            ...currentExperience,
                            description: event.target.value,
                          }))
                        }
                        placeholder="输入这段经历的主要职责、项目方向和成果..."
                        className="min-h-[140px] w-full rounded-[22px] border border-[#d2d2d7] bg-white px-5 py-4 text-[15px] leading-7 text-[#1d1d1f] outline-none resize-y focus:border-[#1d1d1f] transition-colors"
                      />
                    </label>
                  </div>
                </motion.article>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
