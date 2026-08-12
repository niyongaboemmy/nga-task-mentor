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
      <div className="bg-white/80 dark:bg-card-dark/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 dark:border-gray-700/30 p-8">
        {(title || description) && (
          <div className="mb-8 text-center">
            {title && (
              <h2 className="text-2xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm">
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
