import { useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Link, useParams } from "react-router";
import { openProjectPrototypeWindow } from "../config/projectPrototypeWindow";
import {
  getProjectById,
  hasProjectPrototype,
} from "../config/projectsSettings";

export function ProjectPrototype() {
  const { projectId } = useParams();
  const project = getProjectById(projectId);
  const [error, setError] = useState<string | null>(null);

  const handleOpenPrototype = async () => {
    if (!project) return;

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

  if (!project) {
    return (
      <div className="min-h-screen bg-white text-[#1d1d1f] pt-32 pb-24 px-8 md:px-16">
        <div className="max-w-5xl mx-auto">
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 text-[#86868b] hover:text-[#1d1d1f] transition-colors mb-10 font-medium group"
          >
            <ArrowLeft
              size={16}
              className="group-hover:-translate-x-1 transition-transform"
            />
            返回全部作品
          </Link>
          <div className="rounded-[32px] bg-[#f5f5f7] px-8 py-12 text-center">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              未找到该项目
            </h1>
            <p className="text-lg text-[#86868b]">
              当前链接没有对应的项目数据。
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasProjectPrototype(project)) {
    return (
      <div className="min-h-screen bg-white text-[#1d1d1f] pt-32 pb-24 px-8 md:px-16">
        <div className="max-w-5xl mx-auto">
          <Link
            to={`/project/${project.id}`}
            className="inline-flex items-center gap-2 text-[#86868b] hover:text-[#1d1d1f] transition-colors mb-10 font-medium group"
          >
            <ArrowLeft
              size={16}
              className="group-hover:-translate-x-1 transition-transform"
            />
            返回项目详情
          </Link>
          <div className="rounded-[32px] bg-[#f5f5f7] px-8 py-12 text-center">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              暂无 HTML 原型
            </h1>
            <p className="text-lg text-[#86868b]">
              该项目还没有上传可预览的 HTML 导出包。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f] pt-28 pb-24 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link
            to={`/project/${project.id}`}
            className="inline-flex items-center gap-2 text-[#86868b] hover:text-[#1d1d1f] transition-colors font-medium group"
          >
            <ArrowLeft
              size={16}
              className="group-hover:-translate-x-1 transition-transform"
            />
            返回项目详情
          </Link>
        </div>

        <div className="rounded-[32px] border border-[#ececf1] bg-[#f5f5f7] px-8 py-10 md:px-10 md:py-12">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1d1d1f]">
            {project.title || "未命名项目"} HTML 原型
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[#86868b]">
            当前原型会通过本地虚拟静态服务在新窗口打开，尽量保留导出包里的脚本、模块和页面交互能力。
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={() => void handleOpenPrototype()}
              className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-6 py-3 text-sm font-medium text-white hover:bg-[#333336] transition-colors"
            >
              打开 HTML 原型
              <ExternalLink size={16} />
            </button>
            <Link
              to={`/project/${project.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-[#d2d2d7] px-6 py-3 text-sm font-medium text-[#1d1d1f] hover:bg-white transition-colors"
            >
              返回项目详情
            </Link>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <p className="mt-6 text-sm text-[#a0a0a5]">
            如果点击后没有反应，通常是浏览器拦截了弹窗，请允许当前站点打开新窗口后重试。
          </p>
        </div>
      </div>
    </div>
  );
}
