import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Download,
  Eye,
  Image as ImageIcon,
  Maximize2,
  Paperclip,
  X,
} from "lucide-react";
import { ProjectMediaFrame } from "../components/ProjectMediaFrame";
import {
  getProjectById,
  getProjectBackgroundAttachmentMimeType,
  getProjectBackgroundAttachments,
  getProjectBackgroundAttachmentSrc,
  getProjectDesignMediaDisplayMode,
  getProjectDesignMediaSrc,
  getProjectImageDisplayMode,
  getProjectImageSrc,
  isProjectBackgroundAttachmentPreviewable,
  isProjectDesignVideo,
} from "../config/projectsSettings";

export function ProjectDetail() {
  const { projectId } = useParams();
  const project = getProjectById(projectId);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewMediaSrc = getProjectDesignMediaSrc(previewUrl);

  useEffect(() => {
    if (previewUrl) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [previewUrl]);

  if (!project) {
    return (
      <div className="pt-32 pb-24 px-8 md:px-16 max-w-5xl mx-auto min-h-screen text-[#1d1d1f]">
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
          <p className="text-lg text-[#86868b] max-w-2xl mx-auto mb-8">
            当前链接没有对应的项目数据，可能是项目已被删除，或者该项目暂未公开。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/projects"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1d1d1f] text-white font-medium hover:bg-[#333336] transition-colors"
            >
              返回作品列表
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const coverImage = getProjectImageSrc(project);
  const coverDisplayMode = getProjectImageDisplayMode(project);
  const backgroundAttachments = getProjectBackgroundAttachments(project);
  const hasBackgroundContent =
    Boolean(project.background.trim()) || backgroundAttachments.length > 0;

  return (
    <div className="pt-32 pb-24 px-8 md:px-16 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 text-[#86868b] hover:text-[#1d1d1f] transition-colors font-medium group"
        >
          <ArrowLeft
            size={16}
            className="group-hover:-translate-x-1 transition-transform"
          />
          返回全部作品
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="mb-16 text-center"
      >
        <p className="text-sm font-semibold tracking-[0.24em] text-[#86868b] uppercase mb-4">
          {project.category || "未分类项目"}
        </p>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-[#1d1d1f] mb-6">
          {project.title || "未命名项目"}
        </h1>
        <p className="text-xl text-[#86868b] max-w-3xl mx-auto leading-relaxed">
          {project.description || "这个项目暂时还没有补充概览说明。"}
        </p>
      </motion.div>

      {coverImage && (
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.8 }}
          className="mb-24"
        >
          <ProjectMediaFrame
            displayMode={coverDisplayMode}
            showDisplayBadge
            mobileMaxWidthClassName="max-w-[440px]"
            className="shadow-[0_24px_60px_rgba(0,0,0,0.06)]"
          >
            <img
              src={coverImage}
              alt={project.title || "项目封面"}
              className="h-full w-full object-cover"
            />
          </ProjectMediaFrame>
        </motion.section>
      )}

      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="mb-28"
      >
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-[#1d1d1f] mb-4">项目背景</h2>
          <p className="text-[#86868b] text-lg">
            项目的业务背景、目标、限制条件与设计切入点。
          </p>
        </div>

        {hasBackgroundContent ? (
          <div className="bg-[#f5f5f7] rounded-[30px] p-8 md:p-12 shadow-[0_20px_40px_rgba(0,0,0,0.04)]">
            {project.background.trim() ? (
              <div className="bg-white rounded-[24px] p-8 md:p-10 shadow-sm">
                <p className="text-lg text-[#1d1d1f] leading-9 whitespace-pre-wrap">
                  {project.background}
                </p>
              </div>
            ) : null}

            {backgroundAttachments.length > 0 ? (
              <div className={project.background.trim() ? "mt-6" : ""}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-[#1d1d1f] shadow-sm">
                    <Paperclip size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-[#1d1d1f]">
                      背景附件
                    </h3>
                    <p className="text-sm text-[#86868b]">
                      共 {backgroundAttachments.length} 个附件，可直接预览浏览器支持的文件。
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {backgroundAttachments.map((attachment, index) => {
                    const attachmentSrc = getProjectBackgroundAttachmentSrc(
                      attachment.src,
                    );
                    const canPreview =
                      Boolean(attachmentSrc) &&
                      isProjectBackgroundAttachmentPreviewable(attachment);
                    const attachmentMimeType =
                      getProjectBackgroundAttachmentMimeType(attachment) ||
                      "通用文件";

                    return (
                      <div
                        key={`${project.id}-background-attachment-${index}`}
                        className="rounded-[22px] bg-white p-5 shadow-sm"
                      >
                        <p className="truncate text-base font-semibold text-[#1d1d1f]">
                          {attachment.name}
                        </p>
                        <p className="mt-2 text-sm text-[#86868b]">
                          {attachmentMimeType}
                          {canPreview ? " · 可预览" : " · 仅下载"}
                        </p>

                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          {canPreview ? (
                            <a
                              href={attachmentSrc || undefined}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1d1d1f] text-white text-sm font-medium hover:bg-[#333336] transition-colors"
                            >
                              <Eye size={15} />
                              预览附件
                            </a>
                          ) : null}

                          {attachmentSrc ? (
                            <a
                              href={attachmentSrc}
                              download={attachment.name}
                              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#d2d2d7] text-sm text-[#1d1d1f] hover:bg-white transition-colors"
                            >
                              <Download size={15} />
                              下载附件
                            </a>
                          ) : (
                            <span className="text-sm text-[#a0a0a5]">
                              正在加载附件
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="bg-[#f5f5f7] rounded-[30px] px-8 py-14 text-center text-[#86868b] text-lg">
            暂未补充项目背景。
          </div>
        )}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.8 }}
      >
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold text-[#1d1d1f] mb-4">设计内容展示</h2>
            <p className="text-[#86868b] text-lg">
              已保存的设计稿、交互稿、关键视觉稿或演示视频。
            </p>
          </div>
          <p className="text-sm text-[#86868b]">
            共 {project.designImages.length} 项设计素材
          </p>
        </div>

        {project.designImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center w-full h-[300px] bg-[#f5f5f7] rounded-[30px] border border-transparent">
            <div className="p-4 bg-white rounded-full shadow-sm mb-4">
              <ImageIcon className="text-[#d2d2d7]" size={32} />
            </div>
            <p className="text-[#86868b] text-lg">
              暂无设计素材
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {project.designImages.map((imageSrc, index) => {
              const mediaSrc = getProjectDesignMediaSrc(imageSrc);
              const displayMode = getProjectDesignMediaDisplayMode(project, index);
              const isVideo = isProjectDesignVideo(imageSrc);

              return (
                <motion.div
                  key={`${project.id}-preview-${index}`}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="relative group"
                >
                  <ProjectMediaFrame
                    displayMode={displayMode}
                    showDisplayBadge
                    mobileMaxWidthClassName="max-w-[440px]"
                    className="shadow-[0_10px_30px_rgba(0,0,0,0.05)]"
                  >
                    {!mediaSrc ? (
                      <div className="flex h-full w-full items-center justify-center text-[#a0a0a5]">
                        正在加载素材
                      </div>
                    ) : isVideo ? (
                      <>
                        <video
                          src={mediaSrc}
                          controls
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover bg-black"
                        />
                        <div className="absolute left-4 top-14 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                          视频 {index + 1}
                        </div>
                      </>
                    ) : (
                      <>
                        <img
                          src={mediaSrc}
                          alt={`${project.title || "项目"}设计图 ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => setPreviewUrl(imageSrc)}
                            className="rounded-full bg-white/90 p-3 text-[#1d1d1f] shadow-lg transition-all hover:scale-105 hover:bg-white"
                            title="全屏预览"
                          >
                            <Maximize2 size={20} />
                          </button>
                        </div>
                      </>
                    )}
                  </ProjectMediaFrame>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.section>

      <AnimatePresence>
        {previewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 md:p-8"
            onClick={() => setPreviewUrl(null)}
          >
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            >
              <X size={24} />
            </button>
            {!previewMediaSrc ? (
              <div className="text-white/70">正在加载素材</div>
            ) : isProjectDesignVideo(previewUrl) ? (
              <motion.video
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                src={previewMediaSrc}
                controls
                autoPlay
                playsInline
                className="max-w-full max-h-full rounded-[16px] shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              />
            ) : (
              <motion.img
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                src={previewMediaSrc}
                alt="预览图"
                className="max-w-full max-h-full object-contain rounded-[16px] shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
