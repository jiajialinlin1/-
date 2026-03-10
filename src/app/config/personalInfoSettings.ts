export const PERSONAL_INFO_STORAGE_KEY = "portfolio_personal_info_v1";

export interface PersonalInfoSettings {
  gender: string;
  age: string;
  workExperience: string;
  education: string;
  school: string;
  major: string;
  currentLocation: string;
  phone: string;
  email: string;
}

const DEFAULT_PERSONAL_INFO_SETTINGS: PersonalInfoSettings = {
  gender: "男",
  age: "24岁",
  workExperience: "3年（含实习）",
  education: "本科",
  school: "山西应用科技学院",
  major: "数字媒体艺术",
  currentLocation: "北京",
  phone: "17794764416",
  email: "smaolin2846@gmail.com",
};

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function sanitizePersonalInfoSettings(
  input: unknown,
): PersonalInfoSettings {
  if (!input || typeof input !== "object") {
    return DEFAULT_PERSONAL_INFO_SETTINGS;
  }

  const candidate = input as Partial<PersonalInfoSettings>;

  return {
    gender:
      typeof candidate.gender === "string"
        ? candidate.gender
        : DEFAULT_PERSONAL_INFO_SETTINGS.gender,
    age:
      typeof candidate.age === "string"
        ? candidate.age
        : DEFAULT_PERSONAL_INFO_SETTINGS.age,
    workExperience:
      typeof candidate.workExperience === "string"
        ? candidate.workExperience
        : DEFAULT_PERSONAL_INFO_SETTINGS.workExperience,
    education:
      typeof candidate.education === "string"
        ? candidate.education
        : DEFAULT_PERSONAL_INFO_SETTINGS.education,
    school:
      typeof candidate.school === "string"
        ? candidate.school
        : DEFAULT_PERSONAL_INFO_SETTINGS.school,
    major:
      typeof candidate.major === "string"
        ? candidate.major
        : DEFAULT_PERSONAL_INFO_SETTINGS.major,
    currentLocation:
      typeof candidate.currentLocation === "string"
        ? candidate.currentLocation
        : DEFAULT_PERSONAL_INFO_SETTINGS.currentLocation,
    phone:
      typeof candidate.phone === "string"
        ? candidate.phone
        : DEFAULT_PERSONAL_INFO_SETTINGS.phone,
    email:
      typeof candidate.email === "string"
        ? candidate.email
        : DEFAULT_PERSONAL_INFO_SETTINGS.email,
  };
}

export function getPersonalInfoSettings(): PersonalInfoSettings {
  if (!isBrowser()) return DEFAULT_PERSONAL_INFO_SETTINGS;

  try {
    const raw = window.localStorage.getItem(PERSONAL_INFO_STORAGE_KEY);
    if (!raw) return DEFAULT_PERSONAL_INFO_SETTINGS;

    return sanitizePersonalInfoSettings(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_PERSONAL_INFO_SETTINGS;
  }
}

export function savePersonalInfoSettings(settings: PersonalInfoSettings) {
  if (!isBrowser()) return;
  window.localStorage.setItem(
    PERSONAL_INFO_STORAGE_KEY,
    JSON.stringify(settings),
  );
}
