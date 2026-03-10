import {
  isStoredMediaReference,
  migrateDataUrlToStoredMedia,
  resolveStoredMediaSrc,
} from "./mediaStorage";

export type ImageSlotId =
  | "heroPortrait"
  | "projectErp"
  | "projectKnowledge"
  | "projectSmartHome"
  | "projectMedical";

export type ImageOverrides = Partial<Record<ImageSlotId, string>>;

export const IMAGE_OVERRIDES_STORAGE_KEY = "portfolio_image_overrides_v1";
const SETTINGS_UPDATED_EVENT = "portfolio-image-settings-updated";

const SLOT_IDS: ImageSlotId[] = [
  "heroPortrait",
  "projectErp",
  "projectKnowledge",
  "projectSmartHome",
  "projectMedical",
];

const SLOT_ID_SET = new Set<string>(SLOT_IDS);

const DEFAULT_IMAGES: Record<ImageSlotId, string> = {
  heroPortrait:
    "https://images.unsplash.com/photo-1758922584983-82ffd5720c6a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjbGVhbiUyMG1pbmltYWwlMjBwb3J0cmFpdCUyMG1vZGVybnxlbnwxfHx8fDE3NzI2OTYzMzR8MA&ixlib=rb-4.1.0&q=80&w=1080",
  projectErp:
    "https://file.notion.so/f/f/a71f85ca-51c2-46d6-b307-30e427f79ea3/6c85f8f3-4918-40ce-8a7b-6c97c3e48a63/iShot_2026-03-05_14.30.24.png?table=block&id=31a44e03-f979-80f0-a9ce-cb59317395be&spaceId=a71f85ca-51c2-46d6-b307-30e427f79ea3&expirationTimestamp=1772755200000&signature=F2-fnDdVr8SYXYQc7j6yPVujd5MNX35G7poCFsimvOg&downloadName=iShot_2026-03-05_14.30.24.png",
  projectKnowledge:
    "https://images.unsplash.com/photo-1653629213421-83a13907003f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsJTIwbW9iaWxlJTIwYXBwJTIwVUklMjBjbGVhbiUyMGRlc2lnbiUyMHNjcmVlbnxlbnwxfHx8fDE3NzI2OTkxNDJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
  projectSmartHome:
    "https://images.unsplash.com/photo-1558002038-1055907df827?ixlib=rb-4.0.3&auto=format&fit=crop&w=1080&q=80",
  projectMedical:
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&auto=format&fit=crop&w=1080&q=80",
};

export interface ImageSlot {
  id: ImageSlotId;
  title: string;
  description: string;
  usedIn: string;
  defaultSrc: string;
}

export const IMAGE_SLOTS: ImageSlot[] = [
  {
    id: "heroPortrait",
    title: "首页主视觉头像",
    description: "Home 页面 Hero 右侧展示图",
    usedIn: "首页",
    defaultSrc: DEFAULT_IMAGES.heroPortrait,
  },
  {
    id: "projectErp",
    title: "企业资源管理系统 (ERP)",
    description: "项目卡片封面图",
    usedIn: "首页精选作品 + 全部作品",
    defaultSrc: DEFAULT_IMAGES.projectErp,
  },
  {
    id: "projectKnowledge",
    title: "知识付费产品",
    description: "项目卡片封面图",
    usedIn: "首页精选作品 + 全部作品",
    defaultSrc: DEFAULT_IMAGES.projectKnowledge,
  },
  {
    id: "projectSmartHome",
    title: "智能家居控制中心",
    description: "项目卡片封面图",
    usedIn: "全部作品",
    defaultSrc: DEFAULT_IMAGES.projectSmartHome,
  },
  {
    id: "projectMedical",
    title: "数字医疗看板系统",
    description: "项目卡片封面图",
    usedIn: "全部作品",
    defaultSrc: DEFAULT_IMAGES.projectMedical,
  },
];

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitSettingsUpdated() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
}

function sanitizeOverrides(input: unknown): ImageOverrides {
  if (!input || typeof input !== "object") return {};

  const result: ImageOverrides = {};
  for (const [key, value] of Object.entries(input)) {
    if (SLOT_ID_SET.has(key) && typeof value === "string" && value.trim()) {
      result[key as ImageSlotId] = value;
    }
  }
  return result;
}

export function getImageOverrides(): ImageOverrides {
  if (!isBrowser()) return {};

  try {
    const raw = window.localStorage.getItem(IMAGE_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return sanitizeOverrides(parsed);
  } catch {
    return {};
  }
}

function saveImageOverrides(overrides: ImageOverrides) {
  if (!isBrowser()) return;
  window.localStorage.setItem(
    IMAGE_OVERRIDES_STORAGE_KEY,
    JSON.stringify(overrides),
  );
  emitSettingsUpdated();
}

export function getImageOverride(slotId: ImageSlotId) {
  return getImageOverrides()[slotId];
}

export function replaceImageOverrides(overrides: ImageOverrides) {
  saveImageOverrides(sanitizeOverrides(overrides));
}

export function getImageSrc(slotId: ImageSlotId): string | null {
  const overrideSrc = getImageOverride(slotId);
  if (!overrideSrc) return DEFAULT_IMAGES[slotId];

  return resolveStoredMediaSrc(overrideSrc);
}

export function collectImageOverrideRefs() {
  return Object.values(getImageOverrides()).filter((src): src is string =>
    isStoredMediaReference(src),
  );
}

export async function migrateImageOverridesToIndexedDb() {
  if (!isBrowser()) return;

  const currentOverrides = getImageOverrides();
  const nextOverrides: ImageOverrides = { ...currentOverrides };
  let changed = false;

  for (const [slotId, src] of Object.entries(currentOverrides)) {
    if (!src || isStoredMediaReference(src) || !src.startsWith("data:")) {
      continue;
    }

    nextOverrides[slotId as ImageSlotId] = await migrateDataUrlToStoredMedia(src);
    changed = true;
  }

  if (changed) {
    saveImageOverrides(nextOverrides);
  }
}

export function setImageOverride(slotId: ImageSlotId, src: string) {
  const normalizedSrc = src.trim();
  if (!normalizedSrc) return;
  const overrides = getImageOverrides();
  overrides[slotId] = normalizedSrc;
  saveImageOverrides(overrides);
}

export async function clearImageOverride(slotId: ImageSlotId) {
  const overrides = getImageOverrides();
  const previousSrc = overrides[slotId];
  delete overrides[slotId];
  saveImageOverrides(overrides);
  return previousSrc;
}

export async function clearAllImageOverrides() {
  const overrides = getImageOverrides();
  saveImageOverrides({});
  return Object.values(overrides);
}

export { SETTINGS_UPDATED_EVENT };
