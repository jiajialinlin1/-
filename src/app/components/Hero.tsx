import { motion } from "motion/react";
import { getImageSrc } from "../config/imageSettings";
import { ContactDialog } from "./ContactDialog";

export function Hero() {
  const heroImageSrc = getImageSrc("heroPortrait");

  const handleViewWork = () => {
    const workSection = document.getElementById("work");
    if (!workSection) return;

    workSection.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="pt-32 pb-20 px-8 md:px-16 max-w-7xl mx-auto flex flex-col-reverse md:flex-row items-center gap-16 min-h-[90vh]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="flex-1 flex flex-col items-start gap-8"
      >
        <h1 className="font-bold tracking-tight text-[#1d1d1f] leading-tight text-[64px]">
          <span className="block">你好，我是宋茂林</span>
          <span className="block text-[#86868b]">产品经理。</span>
        </h1>
        <p className="text-lg md:text-xl text-[#86868b] max-w-lg leading-relaxed">
          我致力于打造极简、直观且像素级完美的数字体验，将形式与功能完美融合。
        </p>
        <div className="flex gap-4">
          <button
            onClick={handleViewWork}
            className="px-8 py-4 rounded-full bg-[#1d1d1f] text-white font-medium hover:scale-105 transition-transform shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
          >
            查看作品
          </button>
          <ContactDialog
            trigger={
              <button className="px-8 py-4 rounded-full bg-[#f5f5f7] text-[#1d1d1f] font-medium hover:bg-[#e8e8ed] transition-colors">
                联系我
              </button>
            }
          />
        </div>
      </motion.div>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="flex-1 w-full"
      >
        <div className="relative aspect-[4/5] md:aspect-square max-w-md mx-auto rounded-[30px] overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.08)] bg-[#f5f5f7]">
          {heroImageSrc ? (
            <img 
              src={heroImageSrc} 
              alt="Alex - 资深 UI 设计师"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#a0a0a5]">
              正在加载图片
            </div>
          )}
        </div>
      </motion.div>
    </section>
  )
}
