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

interface PreviewWindowLoadingController {
  complete: (nextMessage?: string) => Promise<void>;
  dispose: () => void;
  fail: (title: string, message: string) => void;
  setProgress: (nextProgress: number, nextMessage?: string) => void;
}

const activePreviewSessions = new Set<PreviewWindowSession>();

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function wait(duration: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

function renderPreviewWindowState(
  previewWindow: Window,
  title: string,
  message: string,
) {
  previewWindow.document.title = title;
  previewWindow.document.body.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f5f7;color:#1d1d1f;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',sans-serif;padding:32px;box-sizing:border-box;">
      <div style="max-width:480px;width:100%;background:#ffffff;border-radius:24px;padding:32px;box-shadow:0 20px 60px rgba(0,0,0,0.08);">
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;">${escapeHtml(title)}</h1>
        <p style="margin:0;color:#6e6e73;font-size:16px;line-height:1.7;">${escapeHtml(message)}</p>
      </div>
    </main>
  `;
}

function createPreviewWindowLoadingController(
  previewWindow: Window,
  title: string,
  message: string,
): PreviewWindowLoadingController {
  previewWindow.document.title = title;
  previewWindow.document.body.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f5f7;color:#1d1d1f;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',sans-serif;padding:32px;box-sizing:border-box;">
      <div style="max-width:520px;width:100%;background:#ffffff;border-radius:28px;padding:36px;box-shadow:0 24px 72px rgba(0,0,0,0.08);">
        <p style="margin:0 0 18px;font-size:12px;font-weight:700;letter-spacing:0.18em;color:#86868b;text-transform:uppercase;">Loading Prototype</p>
        <h1 id="prototype-loading-title" style="margin:0 0 18px;font-size:24px;line-height:1.2;">${escapeHtml(title)}</h1>
        <p id="prototype-loading-message" style="margin:0 0 24px;color:#6e6e73;font-size:16px;line-height:1.7;">${escapeHtml(message)}</p>
        <div style="position:relative;height:12px;border-radius:999px;background:#ececf1;overflow:hidden;">
          <div id="prototype-loading-progress" style="height:100%;width:6%;border-radius:999px;background:linear-gradient(90deg,#1d1d1f 0%,#3f72ff 100%);box-shadow:0 0 20px rgba(63,114,255,0.28);transition:width 280ms cubic-bezier(.22,1,.36,1);"></div>
          <div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.5) 50%,transparent 100%);transform:translateX(-100%);animation:prototype-loading-shimmer 1.6s linear infinite;"></div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px;">
          <span style="font-size:13px;color:#86868b;">原型资源准备中</span>
          <span id="prototype-loading-percent" style="font-size:13px;font-weight:700;color:#1d1d1f;">6%</span>
        </div>
      </div>
    </main>
    <style>
      @keyframes prototype-loading-shimmer {
        from { transform: translateX(-100%); }
        to { transform: translateX(100%); }
      }
    </style>
  `;

  const messageElement = previewWindow.document.getElementById(
    "prototype-loading-message",
  );
  const progressElement = previewWindow.document.getElementById(
    "prototype-loading-progress",
  );
  const percentElement = previewWindow.document.getElementById(
    "prototype-loading-percent",
  );

  let progress = 6;
  let disposed = false;

  const renderProgress = () => {
    if (disposed) return;
    if (progressElement) {
      progressElement.style.width = `${progress}%`;
    }
    if (percentElement) {
      percentElement.textContent = `${Math.round(progress)}%`;
    }
  };

  renderProgress();

  const fakeProgressTimer = window.setInterval(() => {
    if (disposed) return;
    if (progress >= 92) return;

    const remaining = 92 - progress;
    progress = Math.min(92, progress + Math.max(0.8, remaining * 0.08));
    renderProgress();
  }, 180);

  const setProgress = (nextProgress: number, nextMessage?: string) => {
    if (disposed) return;

    progress = Math.max(progress, Math.min(100, nextProgress));
    if (nextMessage && messageElement) {
      messageElement.textContent = nextMessage;
    }
    renderProgress();
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    window.clearInterval(fakeProgressTimer);
  };

  return {
    complete: async (nextMessage?: string) => {
      if (disposed) return;
      if (nextMessage && messageElement) {
        messageElement.textContent = nextMessage;
      }

      progress = 100;
      renderProgress();
      await wait(320);
      dispose();
    },
    dispose,
    fail: (nextTitle: string, nextMessage: string) => {
      dispose();
      if (!previewWindow.closed) {
        renderPreviewWindowState(previewWindow, nextTitle, nextMessage);
      }
    },
    setProgress: (nextProgress: number, nextMessage?: string) => {
      setProgress(nextProgress, nextMessage);
    },
  };
}

async function createPreviewSessionFiles(project: ProjectItem) {
  let files: PrototypePreviewSessionFile[] = [];

  if (project.prototypeBundle) {
    const bundledFiles = await loadPrototypePackageBundleFiles(
      project.prototypeBundle,
    );

    if (bundledFiles.length > 0) {
      files = bundledFiles;
    }
  }

  if (files.length === 0 && hasProjectPrototypePackage(project)) {
    files = getProjectPrototypePackageFiles(project);
  }

  if (files.length === 0) {
    if (!project.prototypeHtml) {
      return [];
    }

    files = [
      {
        blobData: undefined,
        path: getProjectPrototypeEntryPath(project) || "index.html",
        src: project.prototypeHtml,
        mimeType: "text/html",
      } satisfies PrototypePreviewSessionFile,
    ];
  }
  return files;
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

  const loadingController = createPreviewWindowLoadingController(
    previewWindow,
    `${project.title || "项目"} HTML 原型`,
    "正在准备原型内容，请稍候。",
  );

  try {
    const registration = await ensurePrototypePreviewServiceWorker();
    if (!registration) {
      loadingController.fail(
        "当前浏览器不支持预览",
        "当前浏览器无法启用本地原型预览服务，请更换浏览器后重试。",
      );
      return "unavailable";
    }

    loadingController.setProgress(28, "正在建立预览环境...");
    await cleanupExpiredPrototypePreviewSessions();

    loadingController.setProgress(52, "正在整理原型资源...");
    const entryPath = getProjectPrototypeEntryPath(project);
    const files = await createPreviewSessionFiles(project);

    if (!entryPath || files.length === 0) {
      loadingController.fail(
        "原型不可用",
        "当前导出包缺少可用入口页，请重新上传后再试。",
      );
      return "unavailable";
    }

    loadingController.setProgress(78, "正在写入预览会话...");
    const sessionId = createPrototypePreviewSessionId();
    await savePrototypePreviewSession({
      id: sessionId,
      entryPath,
      files,
      projectId: project.id,
    });

    if (previewWindow.closed) {
      loadingController.dispose();
      await deletePrototypePreviewSession(sessionId);
      return "popup_blocked";
    }

    trackPreviewWindow(previewWindow, sessionId);
    await loadingController.complete("正在打开原型页面...");
    previewWindow.location.replace(
      createPrototypePreviewUrl(sessionId, entryPath),
    );
    return "opened";
  } catch {
    if (!previewWindow.closed) {
      loadingController.fail(
        "原型打开失败",
        "当前导出包暂时无法预览。你可以返回上一页重新上传，或稍后再试。",
      );
    }

    return "unavailable";
  }
}
