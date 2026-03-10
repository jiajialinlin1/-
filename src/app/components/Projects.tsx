import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router";
import { ProjectMediaFrame } from "./ProjectMediaFrame";
import { openProjectPrototypeWindow } from "../config/projectPrototypeWindow";
import {
  getProjectImageDisplayMode,
  getProjectImageSrc,
  getProjects,
  hasProjectPrototype,
} from "../config/projectsSettings";

export function Projects() {
  const navigate = useNavigate();
  const projects = getProjects().filter((project) => project.showOnHome);

  const handleOpenPrototype = async (
    project: ReturnType<typeof getProjects>[number],
  ) => {
    const result = await openProjectPrototypeWindow(project);
    if (result === "popup_blocked") {
      window.alert("浏览器拦截了新窗口，请允许当前站点打开新窗口后重试。");
      return;
    }

    if (result === "unavailable") {
      window.alert("当前 HTML 原型暂时无法打开，请刷新后重试或重新上传导出包。");
    }
  };

  return (
    <section id="work" className="py-24 px-8 md:px-16 max-w-7xl mx-auto scroll-mt-24">
      <div className="mb-20 text-center">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1d1d1f] mb-4">精选作品</h2>
        <p className="text-xl text-[#86868b]">展现对细节与品质的极致追求。</p>
      </div>

      <div className="flex flex-col gap-32">
        {projects.length === 0 ? (
          <div className="rounded-[30px] bg-[#f5f5f7] p-10 text-center text-[#86868b] text-lg">
            暂无显示到主页的项目。
          </div>
        ) : (
          projects.map((project) => {
            const imageSrc = getProjectImageSrc(project);
            const imageDisplayMode = getProjectImageDisplayMode(project);
            const projectDetailPath = `/project/${project.id}`;

            return (
              <div 
                key={project.id}
                className={`flex flex-col ${project.reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-16`}
              >
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8 }}
                  className="w-full md:w-1/2"
                >
                  <ProjectMediaFrame
                    displayMode={imageDisplayMode}
                    showDisplayBadge
                    className="shadow-[0_20px_40px_rgba(0,0,0,0.06)]"
                  >
                    {imageSrc ? (
                      <img 
                        src={imageSrc} 
                        alt={project.title || "项目图片"}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#a0a0a5]">
                        空白项目图片
                      </div>
                    )}
                  </ProjectMediaFrame>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className="w-full md:w-1/2 flex flex-col items-start gap-6"
                >
                  <span className="text-sm font-semibold tracking-widest text-[#86868b] uppercase">{project.category || "未分类项目"}</span>
                  <h3 className="font-bold text-[#1d1d1f] tracking-tight text-[40px]">{project.title || "（空白项目）"}</h3>
                  <p className="text-xl text-[#86868b] leading-relaxed">
                    {project.description || "这是一个新建的空白项目。"}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <button onClick={() => navigate(projectDetailPath)} className="flex items-center gap-2 text-[#1d1d1f] font-semibold hover:gap-4 transition-all group">
                      查看项目 
                      <div className="p-2 bg-[#f5f5f7] rounded-full group-hover:bg-[#1d1d1f] group-hover:text-white transition-colors">
                        <ArrowRight size={16} />
                      </div>
                    </button>
                    {hasProjectPrototype(project) ? (
                      <button
                        onClick={() => void handleOpenPrototype(project)}
                        className="flex items-center gap-2 text-[#86868b] font-semibold hover:text-[#1d1d1f] transition-colors group"
                      >
                        查看HTML
                        <div className="p-2 bg-[#f5f5f7] rounded-full group-hover:bg-[#1d1d1f] group-hover:text-white transition-colors">
                          <ArrowRight size={16} />
                        </div>
                      </button>
                    ) : null}
                  </div>
                </motion.div>
              </div>
            );
          })
        )}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="mt-32 flex justify-center"
      >
        <button 
          onClick={() => navigate('/projects')} 
          className="flex items-center gap-3 px-8 py-4 bg-[#f5f5f7] text-[#1d1d1f] rounded-full font-semibold text-[17px] hover:bg-[#e8e8ed] transition-all duration-300 group"
        >
          查看全部项目
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </motion.div>
    </section>
  )
}
