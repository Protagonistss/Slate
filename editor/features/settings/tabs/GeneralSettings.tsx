// GeneralSettings - General settings tab
import { motion } from "motion/react";
import { Settings2 } from "lucide-react";

export function GeneralSettings() {
  return (
    <motion.div
      key="general"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="flex min-h-[420px] flex-col items-center justify-center text-center"
    >
      <Settings2 size={42} className="mb-4 opacity-25 text-zinc-500" />
      <h2 className="text-[16px] font-medium text-zinc-300">General Settings</h2>
      <p className="mt-2 text-[13px] text-zinc-500">该部分后续继续和 Slate 主线同步。</p>
    </motion.div>
  );
}
