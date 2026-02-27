import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "xxl" | "full";
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  size = "md",
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className = "",
}) => {
  // Handle escape key press
  useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, closeOnEscape, onClose]);

  // Prevent body scroll when modal is open
  // useEffect(() => {
  //   if (isOpen) {
  //     // Use a custom scroll lock instead of setting body overflow
  //     // This prevents the page from jumping
  //     const scrollBarWidth =
  //       window.innerWidth - document.documentElement.clientWidth;
  //     if (scrollBarWidth > 0) {
  //       document.body.style.paddingRight = `${scrollBarWidth}px`;
  //     }
  //     document.body.style.overflow = "hidden";
  //     return () => {
  //       document.body.style.overflow = "unset";
  //       document.body.style.paddingRight = "";
  //     };
  //   }
  // }, [isOpen]);

  const sizeClasses = {
    sm: "max-w-sm mx-4",
    md: "max-w-md mx-4",
    lg: "max-w-lg mx-4",
    xl: "max-w-2xl mx-4",
    xxl: "max-w-4xl mx-4",
    full: "max-w-full",
  };

  const modalVariants = {
    hidden: {
      opacity: 0,
      scale: 0.8,
      y: 50,
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        damping: 25,
        stiffness: 300,
        duration: 0.4,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      y: 20,
      transition: {
        duration: 0.2,
      },
    },
  } as const;

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className={`fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 overflow-hidden ${size === "full" ? "p-0" : "p-4 sm:p-6"}`}
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={closeOnBackdropClick ? onClose : undefined}
      >
        <motion.div
          className={`relative w-full max-h-full flex flex-col ${sizeClasses[size]} ${className}`}
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={`relative bg-white dark:bg-gray-950 overflow-hidden shadow-2xl flex flex-col flex-1 min-h-0 w-full ${size === "full" ? "rounded-none" : "rounded-2xl"}`}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {title}
                    </h2>
                  )}
                  {subtitle &&
                    (typeof subtitle === "string" ? (
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {subtitle}
                      </p>
                    ) : (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {subtitle}
                      </div>
                    ))}
                </div>

                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-2xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-2"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4">{children}</div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};

export default Modal;
