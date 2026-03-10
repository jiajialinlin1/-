import { motion } from "motion/react";
import { PenTool, Wand2, Layers, Code, Briefcase } from "lucide-react";

export function BentoGrid() {
  const cards = [
    {
      title: "精通设计工具",
      description: "精通 Figma、Axure、墨刀、Adobe Photoshop、Illustrator。",
      icon: <PenTool className="w-8 h-8 text-[#1d1d1f]" />,
      colSpan: "md:col-span-1",
      number: "01"
    },
    {
      title: "AI 赋能与多媒体产出",
      description: "熟练使用 Midjourney 生成设计素材与图标；使用 Figma AI 辅助排版与灵感发散；熟练使用剪映进行视频粗剪与交互演示，能独立剪辑产品演示视频，综合产出能力强。",
      icon: <Wand2 className="w-8 h-8 text-[#1d1d1f]" />,
      colSpan: "md:col-span-2",
      number: "02"
    },
    {
      title: "全链路核心设计能力",
      description: "B端/SaaS系统设计、C端小程序，数据可视化设计、多端适配（Mobile/Web/Watch/VR）、交互原型绘制、UI组件库搭建。",
      icon: <Layers className="w-8 h-8 text-[#1d1d1f]" />,
      colSpan: "md:col-span-2",
      number: "03"
    },
    {
      title: "扎实的前端基础",
      description: "了解前端基础（HTML/CSS结构）及主流组件库（Element UI / Vue组件）的设计规范。",
      icon: <Code className="w-8 h-8 text-[#1d1d1f]" />,
      colSpan: "md:col-span-1",
      number: "04"
    },
    {
      title: "行业经验与标准化构建",
      description: "拥有律所ERP、数字化审计平台的设计经验。擅长使用 墨刀/Figma 搭建标准化的组件库，确保设计的一致性，提升团队协作效率。",
      icon: <Briefcase className="w-8 h-8 text-[#1d1d1f]" />,
      colSpan: "md:col-span-3",
      number: "05"
    }
  ];

  return (
    <section id="about" className="py-24 px-8 md:px-16 max-w-7xl mx-auto">
      <div className="mb-16">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1d1d1f] mb-4">核心优势</h2>
        <p className="text-xl text-[#86868b]">为什么众多公司选择与我合作。</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ delay: index * 0.1, duration: 0.6 }}
            className={`bg-[#f5f5f7] p-10 rounded-[30px] flex flex-col justify-between ${card.colSpan} hover:scale-[1.02] transition-transform duration-300 shadow-sm`}
          >
            <div className="flex justify-between items-start mb-8">
              <div className="p-4 bg-white/60 backdrop-blur-md rounded-[20px] shadow-sm">
                {card.icon}
              </div>
              <span className="text-3xl font-bold text-[#e1e1e1] tracking-tighter">{card.number}</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[#1d1d1f] mb-3">{card.title}</h3>
              <p className="text-[#86868b] text-lg leading-relaxed">{card.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}