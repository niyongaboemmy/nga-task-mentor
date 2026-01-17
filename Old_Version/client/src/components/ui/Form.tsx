import React from "react";

interface FormProps {
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  className?: string;
  title?: string;
  description?: string;
}

export const Form: React.FC<FormProps> = ({
  children,
  onSubmit,
  className = "",
  title,
  description,
}) => {
  return (
    <div className={`max-w-2xl mx-auto ${className}`}>
      <div className="bg-white/80 dark:bg-gray-900 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-800/50 p-8">
        {(title || description) && (
          <div className="mb-8 text-center">
            {title && (
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {description}
              </p>
            )}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          {children}
        </form>
      </div>
    </div>
  );
};
