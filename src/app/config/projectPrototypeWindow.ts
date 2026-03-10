import {
  createPrototypePreviewSessionId,
  createPrototypePreviewUrl,
  deletePrototypePreviewSession,
  savePrototypePreviewSession,
  cleanupExpiredPrototypePreviewSessions,
  type PrototypePreviewSessionFile,
} from "./prototypePreviewSession";
import { ensurePrototypePreviewServiceWorker } from "./prototypePreviewServiceWorker";
import {
  getProjectPrototypeEntryPath,
  getProjectPrototypePackageFiles,
  hasProjectPrototype,
  hasProjectPrototypePackage,
  type ProjectItem,
} from "./projectsSettings";
import { loadPrototypePackageBundleFiles } from "./prototypePackageBundle";

export type OpenProjectPrototypeResult =
  | "opened"
  | "popup_blocked"
  | "unavailable";

interface PreviewWindowSession {
  intervalId: number;
  previewWindow: Window;
  sessionId: string;
}

const activePreviewSessions = new Set<PreviewWindowSession>();

function renderPreviewWindowState(
  previewWindow: Window,
  title: string,
  message: string,
) {
  previewWindow.document.title = title;
  previewWindow.document.body.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f5f7;color:#1d1d1f;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',sans-serif;padding:32px;box-sizing:border-box;">
      <div style="max-width:480px;width:100%;background:#ffffff;border-radius:24px;padding:32px;box-shadow:0 20px 60px rgba(0,0,0,0.08);">
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;">${title}</h1>
        <p style="margin:0;color:#6e6e73;font-size:16px;line-height:1.7;">${message}</p>
      </div>
    </main>
  `;
}

async function createPreviewSessionFiles(project: ProjectItem) {
  if (project.prototypeBundle) {
    const bundledFiles = await loadPrototypePackageBundleFiles(
      project.prototypeBundle,
    );

    if (bundledFiles.length > 0) {
      return bundledFiles;
    }
  }

  if (hasProjectPrototypePackage(project)) {
    return getProjectPrototypePackageFiles(project);
  }

  if (!project.prototypeHtml) {
    return [];
  }

  return [
    {
      blobData: undefined,
      path: getProjectPrototypeEntryPath(project) || "index.html",
      src: project.prototypeHtml,
      mimeType: "text/html",
    } satisfies PrototypePreviewSessionFile,
  ];
}

function trackPreviewWindow(previewWindow: Window, sessionId: string) {
  const session: PreviewWindowSession = {
    intervalId: window.setInterval(() => {
      if (previewWindow.closed) {
        window.clearInterval(session.intervalId);
        activePreviewSessions.delete(session);
        void deletePrototypePreviewSession(sessionId);
      }
    }, 1000),
    previewWindow,
    sessionId,
  };

  activePreviewSessions.add(session);
}

export async function openProjectPrototypeWindow(
  project: ProjectItem,
): Promise<OpenProjectPrototypeResult> {
  if (typeof window === "undefined" || !hasProjectPrototype(project)) {
    return "unavailable";
  }

  const previewWindow = window.open("", "_blank");
  if (!previewWindow) {
    return "popup_blocked";
  }

  renderPreviewWindowState(
    previewWindow,
    `${project.title || "项目"} HTML 原型`,
    "正在准备原型内容，请稍候。",
  );

  try {
    const registration = await ensurePrototypePreviewServiceWorker();
    if (!registration) {
      renderPreviewWindowState(
        previewWindow,
        "当前浏览器不支持预览",
        "当前浏览器无法启用本地原型预览服务，请更换浏览器后重试。",
      );
      return "unavailable";
    }

    await cleanupExpiredPrototypePreviewSessions();

    const entryPath = getProjectPrototypeEntryPath(project);
    const files = await createPreviewSessionFiles(project);

    if (!entryPath || files.length === 0) {
      renderPreviewWindowState(
        previewWindow,
        "原型不可用",
        "当前导出包缺少可用入口页，请重新上传后再试。",
      );
      return "unavailable";
    }

    const sessionId = createPrototypePreviewSessionId();
    await savePrototypePreviewSession({
      id: sessionId,
      entryPath,
      files,
      projectId: project.id,
    });

    if (previewWindow.closed) {
      await deletePrototypePreviewSession(sessionId);
      return "popup_blocked";
    }

    trackPreviewWindow(previewWindow, sessionId);
    previewWindow.location.replace(
      createPrototypePreviewUrl(sessionId, entryPath),
    );
    return "opened";
  } catch {
    if (!previewWindow.closed) {
      renderPreviewWindowState(
        previewWindow,
        "原型打开失败",
        "当前导出包暂时无法预览。你可以返回上一页重新上传，或稍后再试。",
      );
    }

    return "unavailable";
  }
}
