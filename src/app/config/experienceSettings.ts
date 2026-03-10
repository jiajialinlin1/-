export const EXPERIENCES_STORAGE_KEY = "portfolio_experiences_v1";

export interface ExperienceItem {
  id: string;
  company: string;
  role: string;
  period: string;
  description: string;
}

const DEFAULT_EXPERIENCES: ExperienceItem[] = [
  {
    id: "experience-1",
    company: "大律云（北京）科技有限公司",
    role: "UX交互设计师",
    period: "2025.04 - 至今 | 北京",
    description: "主导律所ERP系统（PC+Mobile）及知识付费产品的全链路交互设计。",
  },
  {
    id: "experience-2",
    company: "上海新致股份有限公司",
    role: "UX交互设计师",
    period: "2024.10 - 2025.04",
    description: "主导多个数字化平台及可视化大屏的体验设计，专注于B端数据呈现。",
  },
  {
    id: "experience-3",
    company: "北京丰沃智慧科技有限公司山西分公司",
    role: "UI设计师（实习）",
    period: "2023.06 - 2024.04",
    description: "核心职责参与产品的整体规划，与产品经理和研发团队沟通写作，绘制出设计图。",
  },
];

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function sanitizeExperience(input: unknown): ExperienceItem | null {
  if (!input || typeof input !== "object") return null;

  const candidate = input as Partial<ExperienceItem>;
  if (!candidate.id || typeof candidate.id !== "string") return null;
  const defaultExperience = DEFAULT_EXPERIENCES.find(
    (experience) => experience.id === candidate.id,
  );

  return {
    id: candidate.id,
    company:
      typeof candidate.company === "string"
        ? candidate.company
        : (defaultExperience?.company ?? ""),
    role:
      typeof candidate.role === "string" ? candidate.role : (defaultExperience?.role ?? ""),
    period:
      typeof candidate.period === "string"
        ? candidate.period
        : (defaultExperience?.period ?? ""),
    description:
      typeof candidate.description === "string"
        ? candidate.description
        : (defaultExperience?.description ?? ""),
  };
}

export function getExperiences(): ExperienceItem[] {
  if (!isBrowser()) return DEFAULT_EXPERIENCES;

  try {
    const raw = window.localStorage.getItem(EXPERIENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_EXPERIENCES;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_EXPERIENCES;

    const experiences = parsed
      .map((item) => sanitizeExperience(item))
      .filter((item): item is ExperienceItem => Boolean(item));

    return experiences.length > 0 ? experiences : DEFAULT_EXPERIENCES;
  } catch {
    return DEFAULT_EXPERIENCES;
  }
}

export function saveExperiences(experiences: ExperienceItem[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(
    EXPERIENCES_STORAGE_KEY,
    JSON.stringify(experiences),
  );
}

export function createBlankExperience(index: number): ExperienceItem {
  const now = Date.now();

  return {
    id: `experience-custom-${now}-${index}`,
    company: "",
    role: "",
    period: "",
    description: "",
  };
}
