"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowRightLeft, Plus, X } from "lucide-react";
import { useEffect } from "react";

interface ConflictConfirmModalProps {
  isOpen: boolean;
  title?: string;
  slotLabel: string; // e.g. "Saturday Morning"
  existingTitle: string;
  newEventTitle: string;
  onReplace: () => void;
  onKeepBoth: () => void;
  onCancel: () => void;
}

export default function ConflictConfirmModal({
  isOpen,
  title = "Overlapping Event",
  slotLabel,
  existingTitle,
  newEventTitle,
  onReplace,
  onKeepBoth,
  onCancel,
}: ConflictConfirmModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  // Prevent background scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <motion.div
            className="fixed inset-0 bg-black/60 dark:bg-black/85 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />

          {/* Modal Container */}
          <motion.div
            className="relative bg-white/95 dark:bg-slate-900/98 backdrop-blur-xl border border-white/20 dark:border-white/10 p-6 rounded-2xl max-w-md w-full mx-auto shadow-2xl flex flex-col items-center overflow-hidden"
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            role="alertdialog"
            aria-modal="true"
          >
            {/* Close corner button */}
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 w-7 h-7 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>

            {/* Icon Header */}
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-amber-500 mb-3">
              <AlertCircle size={24} />
            </div>

            {/* Header Title */}
            <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight mb-2 text-center">
              {title}
            </h2>

            {/* Time Slot Banner */}
            <div className="px-3 py-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-full text-[10px] md:text-xs font-semibold text-amber-600 dark:text-amber-400 mb-4">
              Slot: {slotLabel}
            </div>

            {/* Comparison Cards */}
            <div className="w-full space-y-3 mb-6 text-left">
              <div className="p-3 bg-gray-50/50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Currently Scheduled
                </span>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 line-clamp-2">
                  {existingTitle}
                </p>
              </div>

              <div className="p-3 bg-blue-50/20 dark:bg-blue-950/10 rounded-xl border border-blue-100/30 dark:border-blue-950/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 dark:text-blue-400 block mb-1">
                  Add New Event
                </span>
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 line-clamp-2">
                  {newEventTitle}
                </p>
              </div>
            </div>

            {/* Interactive Options Stack */}
            <div className="flex flex-col gap-2.5 w-full">
              <button
                onClick={onReplace}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-white text-xs font-bold bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-md shadow-blue-500/20 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
              >
                <ArrowRightLeft size={14} />
                Replace Existing Event
              </button>

              <button
                onClick={onKeepBoth}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-white text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-md shadow-emerald-500/20 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
              >
                <Plus size={14} />
                Keep Both (Add Alongside)
              </button>

              <button
                onClick={onCancel}
                className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 text-xs font-bold transition-all cursor-pointer text-center"
              >
                Cancel & Keep Existing
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
