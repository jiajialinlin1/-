import { motion } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { ProjectMediaFrame } from "../components/ProjectMediaFrame";
import { openProjectPrototypeWindow } from "../config/projectPrototypeWindow";
import {
  getProjectImageDisplayMode,
  getProjectImageSrc,
  getProjects,
  hasProjectPrototype,
} from "../config/projectsSettings";

export function ProjectsList() {
  const navigate = useNavigate();
  const projects = getProjects();

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
    <div className="min-h-screen bg-white text-[#1d1d1f] pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-8 md:px-16">
        <Link to="/#work" className="inline-flex items-center gap-2 text-[#86868b] hover:text-[#1d1d1f] transition-colors mb-12 font-medium group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          返回首页
        </Link>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-20"
        >
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">全部作品</h1>
          <p className="text-xl text-[#86868b] max-w-2xl">
            这里展示了我过往更多的设计探索与项目实践，涵盖B端、C端以及其他领域的尝试。
          </p>
        </motion.div>

        <div className="flex flex-col gap-32">
          {projects.map((project) => {
            const imageSrc = getProjectImageSrc(project);
            const imageDisplayMode = getProjectImageDisplayMode(project);
            const projectName = project.title || "未命名项目";
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
                  <div onClick={() => navigate(projectDetailPath)}>
                    <ProjectMediaFrame
                      displayMode={imageDisplayMode}
                      showDisplayBadge
                      className="cursor-pointer shadow-[0_20px_40px_rgba(0,0,0,0.06)] transition-shadow duration-500 hover:shadow-[0_30px_60px_rgba(0,0,0,0.12)]"
                    >
                    {imageSrc ? (
                      <img 
                        src={imageSrc}
                        alt={projectName}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#a0a0a5]">
                        空白项目图片
                      </div>
                    )}
                    </ProjectMediaFrame>
                  </div>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className="w-full md:w-1/2 flex flex-col items-start gap-6"
                >
                  <span className="text-sm font-semibold tracking-widest text-[#86868b] uppercase">{project.category || "未分类项目"}</span>
                  <h3 className="font-bold text-[#1d1d1f] tracking-tight text-[40px] leading-tight">{project.title || "（空白项目）"}</h3>
                  <p className="text-xl text-[#86868b] leading-relaxed">
                    {project.description || "这是一个新建的空白项目，请补充项目描述。"}
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
          })}
        </div>
      </div>
    </div>
  );
}
