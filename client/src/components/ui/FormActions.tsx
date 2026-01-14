import React from "react";

interface FormActionsProps {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right" | "between";
}

export const FormActions: React.FC<FormActionsProps> = ({
  children,
  className = "",
  align = "right",
}) => {
  const alignmentClasses = {
    left: "justify-start",
    center: "justify-center",
    right: "justify-end",
    between: "justify-between",
  };

  return (
    <div
      className={`flex items-center gap-3 pt-6 border-t border-gray-100 dark:border-gray-800/50 ${alignmentClasses[align]} ${className}`}
    >
      {children}
    </div>
  );
};
