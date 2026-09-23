// Motion shared by the grade-report screens. Kept out of reportUi.tsx so that
// file exports components only (React Fast Refresh requires it).

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 120, damping: 18 },
  },
};
