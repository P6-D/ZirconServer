"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export const AnimatedCard = ({
  children,
  className,
  title,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  delay?: number;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={cn(
        "relative flex flex-col rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-md",
        "overflow-hidden before:absolute before:inset-0 before:z-[-1] before:bg-gradient-to-br before:from-white/5 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500",
        className
      )}
    >
      {title && (
        <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-neutral-400">
          {title}
        </h3>
      )}
      {children}
    </motion.div>
  );
};
