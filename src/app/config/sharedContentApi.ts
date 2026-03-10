import {
  IMAGE_OVERRIDES_STORAGE_KEY,
  getImageOverrides,
} from "./imageSettings";
import {
  PERSONAL_INFO_STORAGE_KEY,
  getPersonalInfoSettings,
  type PersonalInfoSettings,
} from "./personalInfoSettings";
import {
  EXPERIENCES_STORAGE_KEY,
  getExperiences,
  type ExperienceItem,
} from "./experienceSettings";
import {
  PROJECTS_STORAGE_KEY,
  getProjects,
  type ProjectItem,
} from "./projectsSettings";
import {
  getImageSettingsAccessPassword,
  validateImageSettingsPassword,
} from "./imageSettingsAccess";
import {
  SHARED_CONTENT_AUTH_ENDPOINT,
  SHARED_CONTENT_ENDPOINT,
  createSharedContentAuthHeaders,
  hasSharedContentServiceHeader,
} from "./sharedContentEndpoints";

export type SharedContentMode = "local" | "remote";

export type SharedContentSyncStatus =
  | "synced"
  | "local-only"
  | "unauthorized"
  | "failed";

export interface SharedContentSyncResult {
  message?: string;
  status: SharedContentSyncStatus;
}

interface SharedContentDocument {
  experiences?: ExperienceItem[];
  imageOverrides?: ReturnType<typeof getImageOverrides>;
  personalInfo?: PersonalInfoSettings;
  projects?: ProjectItem[];
  updatedAt: string;
  version: number;
}

let remoteServiceAvailable = false;
let sharedContentMode: SharedContentMode = "local";

function isBrowser() {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

function writeSharedContentCache(document: SharedContentDocument) {
  if (!isBrowser()) return;

  if (document.imageOverrides) {
    window.localStorage.setItem(
      IMAGE_OVERRIDES_STORAGE_KEY,
      JSON.stringify(document.imageOverrides),
    );
  }

  if (document.personalInfo) {
    window.localStorage.setItem(
      PERSONAL_INFO_STORAGE_KEY,
      JSON.stringify(document.personalInfo),
    );
  }

  if (document.experiences) {
    window.localStorage.setItem(
      EXPERIENCES_STORAGE_KEY,
      JSON.stringify(document.experiences),
    );
  }

  if (document.projects) {
    window.localStorage.setItem(
      PROJECTS_STORAGE_KEY,
      JSON.stringify(document.projects),
    );
  }
}

function buildSharedContentDocument(): SharedContentDocument {
  return {
    imageOverrides: getImageOverrides(),
    personalInfo: getPersonalInfoSettings(),
    experiences: getExperiences(),
    projects: getProjects(),
    updatedAt: new Date().toISOString(),
    version: 1,
  };
}

export function getSharedContentMode() {
  return sharedContentMode;
}

export function hasRemoteSharedContentService() {
  return remoteServiceAvailable;
}

export async function bootstrapSharedContentCache() {
  if (!isBrowser()) return;

  try {
    const response = await fetch(SHARED_CONTENT_ENDPOINT, {
      cache: "no-store",
    });
    const hasServiceHeader = hasSharedContentServiceHeader(response.headers);

    if (!hasServiceHeader) {
      sharedContentMode = "local";
      remoteServiceAvailable = false;
      return;
    }

    remoteServiceAvailable = true;
    sharedContentMode = "remote";

    if (response.status === 404) {
      return;
    }

    if (!response.ok) {
      sharedContentMode = "local";
      return;
    }

    const document = (await response.json()) as SharedContentDocument;
    writeSharedContentCache(document);
  } catch {
    sharedContentMode = "local";
    remoteServiceAvailable = false;
  }
}

export async function verifySharedContentAccess(password: string) {
  const normalizedPassword = password.trim();
  if (!normalizedPassword) {
    return {
      mode: "local" as SharedContentMode,
      ok: false,
    };
  }

  try {
    const response = await fetch(SHARED_CONTENT_AUTH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password: normalizedPassword,
      }),
    });

    const hasServiceHeader = hasSharedContentServiceHeader(response.headers);
    if (hasServiceHeader) {
      remoteServiceAvailable = true;
      sharedContentMode = "remote";

      if (response.ok) {
        return {
          mode: "remote" as SharedContentMode,
          ok: true,
        };
      }

      if (response.status === 401) {
        return {
          mode: "remote" as SharedContentMode,
          ok: false,
        };
      }

      return {
        errorMessage: "在线存储暂时不可用，请稍后重试。",
        mode: "remote" as SharedContentMode,
        ok: false,
      };
    }
  } catch {
    // Fall back to local-only validation for plain Vite dev.
  }

  sharedContentMode = "local";
  remoteServiceAvailable = false;

  return {
    mode: "local" as SharedContentMode,
    ok: validateImageSettingsPassword(normalizedPassword),
  };
}

export async function syncSharedContentDocument(): Promise<SharedContentSyncResult> {
  if (!isBrowser()) {
    return {
      status: "local-only",
    };
  }

  const password = getImageSettingsAccessPassword();
  if (!password) {
    return {
      message: "当前会话缺少管理密码，请重新进入内容设置。",
      status: remoteServiceAvailable ? "unauthorized" : "local-only",
    };
  }

  try {
    const response = await fetch(SHARED_CONTENT_ENDPOINT, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...createSharedContentAuthHeaders(password),
      },
      body: JSON.stringify(buildSharedContentDocument()),
    });

    const hasServiceHeader = hasSharedContentServiceHeader(response.headers);
    if (!hasServiceHeader) {
      sharedContentMode = "local";
      remoteServiceAvailable = false;
      return {
        status: "local-only",
      };
    }

    remoteServiceAvailable = true;
    sharedContentMode = "remote";

    if (response.status === 401) {
      return {
        message: "在线存储鉴权失败，请重新输入密码。",
        status: "unauthorized",
      };
    }

    if (!response.ok) {
      return {
        message: "在线存储保存失败，请稍后重试。",
        status: "failed",
      };
    }

    const document = (await response.json()) as SharedContentDocument;
    writeSharedContentCache(document);
    return {
      status: "synced",
    };
  } catch {
    return {
      message: "在线存储连接失败，当前修改仅保留在本地浏览器。",
      status: remoteServiceAvailable ? "failed" : "local-only",
    };
  }
}
