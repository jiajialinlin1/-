import { motion } from "motion/react";
import { Menu } from "lucide-react";
import { Link, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { ContactDialog } from "./ContactDialog";
import { ImageSettingsEntry } from "./ImageSettingsEntry";
import { hasImageSettingsAccess } from "../config/imageSettingsAccess";

export function Navbar() {
  const location = useLocation();
  const [contactClickCount, setContactClickCount] = useState(0);
  const [showImageSettingsEntry, setShowImageSettingsEntry] = useState(() =>
    hasImageSettingsAccess(),
  );

  useEffect(() => {
    if (location.hash) {
      setTimeout(() => {
        const id = location.hash.replace('#', '');
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  }, [location]);

  const handleContactTriggerClick = () => {
    if (showImageSettingsEntry) return;

    const nextClickCount = contactClickCount + 1;

    if (nextClickCount >= 5) {
      setShowImageSettingsEntry(true);
      setContactClickCount(0);
      return;
    }

    setContactClickCount(nextClickCount);
  };

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-[0_4px_30px_rgba(0,0,0,0.03)]"
    >
      <Link to="/" className="text-xl font-bold tracking-tight text-[#1d1d1f]">我的简历</Link>
      <div className="hidden md:flex gap-8 text-[#86868b] font-medium text-sm">
        <Link to="/#about" className="hover:text-[#1d1d1f] transition-colors">关于</Link>
        <Link to="/#experience" className="hover:text-[#1d1d1f] transition-colors">经历</Link>
        <Link to="/#work" className="hover:text-[#1d1d1f] transition-colors">作品</Link>
      </div>
      <div className="hidden md:flex items-center gap-3">
        {showImageSettingsEntry ? (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.22 }}
          >
            <ImageSettingsEntry />
          </motion.div>
        ) : null}
        <ContactDialog
          trigger={
            <button
              type="button"
              onClick={handleContactTriggerClick}
              className="px-5 py-2 rounded-full bg-[#1d1d1f] text-white text-sm font-medium hover:bg-black transition-colors"
            >
              联系我
            </button>
          }
        />
      </div>
      <button className="md:hidden text-[#1d1d1f]">
        <Menu size={24} />
      </button>
    </motion.nav>
  )
}
