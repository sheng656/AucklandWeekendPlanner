"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2, HelpCircle, X } from "lucide-react";
import { useEffect } from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "info",
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  
  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  // Disable body scroll when modal is open
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

  const getIcon = () => {
    switch (variant) {
      case "danger":
        return (
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center text-red-500 mb-2">
            <Trash2 size={24} />
          </div>
        );
      case "warning":
        return (
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-amber-500 mb-2">
            <AlertTriangle size={24} />
          </div>
        );
      case "info":
      default:
        return (
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center text-blue-500 mb-2">
            <HelpCircle size={24} />
          </div>
        );
    }
  };

  const getConfirmButtonStyles = () => {
    switch (variant) {
      case "danger":
        return "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-md shadow-red-500/20";
      case "warning":
        return "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-md shadow-amber-500/20";
      case "info":
      default:
        return "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-500/20";
    }
  };

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
            className="relative bg-white/95 dark:bg-slate-900/98 backdrop-blur-xl border border-white/20 dark:border-white/10 p-6 rounded-2xl max-w-sm w-full mx-auto shadow-2xl flex flex-col items-center text-center overflow-hidden"
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby="modal-message"
          >
            
            {/* Close corner button */}
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 w-7 h-7 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>

            {/* Icon Header */}
            {getIcon()}

            {/* Modal Contents */}
            <h2 
              id="modal-title" 
              className="text-lg font-bold text-gray-900 dark:text-white mt-2 leading-tight"
            >
              {title}
            </h2>
            
            <p 
              id="modal-message" 
              className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-2.5 px-1 leading-relaxed"
            >
              {message}
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3 w-full mt-6">
              
              <button
                onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 text-xs font-bold transition-all cursor-pointer"
              >
                {cancelText}
              </button>

              <button
                onClick={onConfirm}
                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition-all cursor-pointer ${getConfirmButtonStyles()}`}
              >
                {confirmText}
              </button>

            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
