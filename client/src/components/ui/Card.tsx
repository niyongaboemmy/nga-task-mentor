import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = "" }) => {
  return (
    <div
      className={`bg-card-light dark:bg-card-dark ${
        className ? "" : "rounded-2xl"
      } ${className}`}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={`px-6 py-4 border-b border-border-light dark:border-gray-700/30 ${className}`}
    >
      {children}
    </div>
  );
};

export const CardTitle: React.FC<CardTitleProps> = ({
  children,
  className = "",
}) => {
  return (
    <h3
      className={`text-lg font-semibold text-text-primary-light dark:text-text-primary-dark ${className}`}
    >
      {children}
    </h3>
  );
};

export const CardContent: React.FC<CardContentProps> = ({
  children,
  className = "",
}) => {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
};
