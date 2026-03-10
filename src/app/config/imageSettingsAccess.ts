// Client-side gate only. Use server-side auth if you need real protection.
const IMAGE_SETTINGS_ACCESS_PASSWORD = "sml2846499028";
const IMAGE_SETTINGS_ACCESS_SESSION_KEY =
  "portfolio_image_settings_access_granted";
const IMAGE_SETTINGS_ACCESS_PASSWORD_SESSION_KEY =
  "portfolio_image_settings_access_password";

export const IMAGE_SETTINGS_ROUTE = "/image-settings";
export const IMAGE_SETTINGS_ENTRY_LABEL = "管理入口";

function isBrowser() {
  return (
    typeof window !== "undefined" &&
    typeof window.sessionStorage !== "undefined"
  );
}

export function validateImageSettingsPassword(password: string) {
  return password === IMAGE_SETTINGS_ACCESS_PASSWORD;
}

export function hasImageSettingsAccess() {
  if (!isBrowser()) return false;
  return (
    window.sessionStorage.getItem(IMAGE_SETTINGS_ACCESS_SESSION_KEY) ===
    "granted"
  );
}

export function getImageSettingsAccessPassword() {
  if (!isBrowser()) return null;
  return (
    window.sessionStorage.getItem(IMAGE_SETTINGS_ACCESS_PASSWORD_SESSION_KEY) ||
    null
  );
}

export function grantImageSettingsAccess(password?: string) {
  if (!isBrowser()) return;
  window.sessionStorage.setItem(
    IMAGE_SETTINGS_ACCESS_SESSION_KEY,
    "granted",
  );

  if (typeof password === "string" && password.trim()) {
    window.sessionStorage.setItem(
      IMAGE_SETTINGS_ACCESS_PASSWORD_SESSION_KEY,
      password.trim(),
    );
  }
}

export function revokeImageSettingsAccess() {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(IMAGE_SETTINGS_ACCESS_SESSION_KEY);
  window.sessionStorage.removeItem(IMAGE_SETTINGS_ACCESS_PASSWORD_SESSION_KEY);
}
