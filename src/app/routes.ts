import { createElement } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { MainLayout } from "./layouts/MainLayout";
import { Home } from "./pages/Home";
import { ProjectDetail } from "./pages/ProjectDetail";
import { ProjectPrototype } from "./pages/ProjectPrototype";
import { ProjectsList } from "./pages/ProjectsList";
import { ImageSettings } from "./pages/ImageSettings";
import { hasImageSettingsAccess } from "./config/imageSettingsAccess";

function ProtectedImageSettings() {
  if (!hasImageSettingsAccess()) {
    return createElement(Navigate, { to: "/", replace: true });
  }

  return createElement(ImageSettings);
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: MainLayout,
    children: [
      { index: true, Component: Home },
      { path: "project", Component: ProjectDetail },
      { path: "project/:projectId", Component: ProjectDetail },
      { path: "project/:projectId/prototype", Component: ProjectPrototype },
      { path: "projects", Component: ProjectsList },
      { path: "image-settings", Component: ProtectedImageSettings },
    ],
  },
], {
  basename: "/",
});
