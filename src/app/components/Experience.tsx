import { motion } from "motion/react";
import { getExperiences } from "../config/experienceSettings";

export function Experience() {
  const experiences = getExperiences();

  return (
    <section id="experience" className="py-24 px-8 md:px-16 max-w-7xl mx-auto scroll-mt-24">
      <div className="mb-16">
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[#1d1d1f] mb-4">工作经历</h2>
        <p className="text-xl text-[#86868b]">不断精进的职业旅程。</p>
      </div>

      <div className="flex flex-col gap-12">
        {experiences.length === 0 ? (
          <div className="rounded-[30px] bg-[#f5f5f7] p-10 text-center text-[#86868b] text-lg">
            暂无工作经历内容。
          </div>
        ) : (
          experiences.map((exp, index) => (
            <motion.div 
              key={exp.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              className="flex flex-col md:flex-row gap-4 md:gap-16 border-b border-[#e5e5ea] pb-12 last:border-0"
            >
              <div className="md:w-1/3">
                <h3 className="text-2xl font-bold text-[#1d1d1f]">
                  {exp.company || "未填写公司名称"}
                </h3>
                <p className="text-[#86868b] text-lg mt-1">
                  {exp.role || "未填写岗位"}
                </p>
              </div>
              <div className="md:w-2/3 flex flex-col md:flex-row gap-4 md:gap-16 justify-between">
                <p className="text-lg text-[#1d1d1f] leading-relaxed max-w-xl">
                  {exp.description || "暂未补充工作经历描述。"}
                </p>
                <span className="text-[#86868b] font-medium whitespace-nowrap">
                  {exp.period || "未填写时间"}
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </section>
  )
}
