// AppearanceSettings - Appearance settings tab
import { motion } from "motion/react";
import { Palette } from "lucide-react";

export function AppearanceSettings() {
  return (
    <motion.div
      key="appearance"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="flex min-h-[420px] flex-col items-center justify-center text-center"
    >
      <Palette size={42} className="mb-4 opacity-25 text-zinc-500" />
      <h2 className="text-[16px] font-medium text-zinc-300">Appearance Settings</h2>
      <p className="mt-2 text-[13px] text-zinc-500">该部分后续继续和 Slate 主线同步。</p>
    </motion.div>
  );
}
