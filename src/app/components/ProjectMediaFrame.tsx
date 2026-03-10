import type { ReactNode } from "react";
import {
  getProjectMediaDisplayModeLabel,
  type ProjectMediaDisplayMode,
} from "../config/projectsSettings";

const DESKTOP_CANVAS_ASPECT_CLASS_NAME = "aspect-[3/2]";
const IPHONE_17_PRO_MAX_SCREEN_ASPECT_CLASS_NAME = "aspect-[110/239]";

interface ProjectMediaFrameProps {
  children: ReactNode;
  className?: string;
  desktopAspectClassName?: string;
  displayMode: ProjectMediaDisplayMode;
  mobileMaxWidthClassName?: string;
  mobilePaddingClassName?: string;
  showDisplayBadge?: boolean;
}

export function ProjectMediaFrame({
  children,
  className = "",
  desktopAspectClassName = DESKTOP_CANVAS_ASPECT_CLASS_NAME,
  displayMode,
  mobileMaxWidthClassName = "max-w-[440px]",
  mobilePaddingClassName = "px-6 py-6 md:px-8 md:py-8",
  showDisplayBadge = false,
}: ProjectMediaFrameProps) {
  const isMobile = displayMode === "mobile";

  return (
    <div
      className={[
        "relative overflow-hidden bg-[#f5f5f7]",
        isMobile
          ? `flex items-center justify-center rounded-[30px] ${mobilePaddingClassName}`
          : `rounded-[30px] ${desktopAspectClassName}`,
        className,
      ].join(" ")}
    >
      {showDisplayBadge ? (
        <div className="absolute left-4 top-4 z-10 rounded-full bg-white/92 px-3 py-1 text-xs font-semibold text-[#1d1d1f] shadow-sm backdrop-blur">
          {getProjectMediaDisplayModeLabel(displayMode)}
        </div>
      ) : null}

      {isMobile ? (
        <div
          className={`w-full ${mobileMaxWidthClassName} ${IPHONE_17_PRO_MAX_SCREEN_ASPECT_CLASS_NAME} overflow-hidden rounded-[28px] bg-white shadow-[0_20px_40px_rgba(0,0,0,0.14)]`}
        >
          {children}
        </div>
      ) : (
        <div className="h-full w-full">{children}</div>
      )}
    </div>
  );
}
