import { motion } from "motion/react";
import { getPersonalInfoSettings } from "../config/personalInfoSettings";

export function PersonalInfo() {
  const personalInfoSettings = getPersonalInfoSettings();
  const info = [
    { label: "性别", value: personalInfoSettings.gender },
    { label: "年龄", value: personalInfoSettings.age },
    { label: "工作经验", value: personalInfoSettings.workExperience },
    { label: "学历", value: personalInfoSettings.education },
    { label: "学校", value: personalInfoSettings.school },
    { label: "专业", value: personalInfoSettings.major },
    { label: "现居住地", value: personalInfoSettings.currentLocation },
    { label: "电话", value: personalInfoSettings.phone },
    { label: "邮箱", value: personalInfoSettings.email },
  ];

  return (
    <section id="about" className="py-12 px-8 md:px-16 max-w-7xl mx-auto scroll-mt-24">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="bg-[#f5f5f7] rounded-[30px] p-8 md:p-12 shadow-sm"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-8 gap-x-8">
          {info.map((item, index) => (
            <div key={index} className="flex flex-col">
              <span className="text-sm text-[#86868b] mb-1 font-medium">{item.label}</span>
              <span className="text-lg font-semibold text-[#1d1d1f]">
                {item.value || "未填写"}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
