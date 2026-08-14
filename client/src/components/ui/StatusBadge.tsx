"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export const StatusBadge = ({
  status,
  label,
  icon,
}: {
  status: boolean;
  label: string;
  icon?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-md transition-colors duration-300",
        status
          ? "border-green-500/30 bg-green-500/10 text-green-400"
          : "border-neutral-800 bg-neutral-900/50 text-neutral-400"
      )}
    >
      <div className="relative flex h-2 w-2 items-center justify-center">
        {status && (
          <motion.div
            animate={{ scale: [1, 1.8, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-full bg-green-500 blur-[2px]"
          />
        )}
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            status ? "bg-green-500" : "bg-neutral-600"
          )}
        />
      </div>
      {icon && <span className="mr-1">{icon}</span>}
      {label}
    </div>
  );
};
