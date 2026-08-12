import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

const Layout: React.FC<{ children: React.ReactNode; fullWidth?: boolean }> = ({
  children,
  fullWidth = false,
}) => {
  const { academicPeriodVersion } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <motion.main
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className={
            fullWidth
              ? "flex-1 w-full py-3 md:py-4 px-4 sm:px-6 lg:px-8"
              : "flex-1 max-w-8xl w-full mx-auto py-3 md:py-4 px-4 sm:px-6 lg:px-8"
          }
        >
          {/* Remounting on academicPeriodVersion forces every page under
              Layout to re-run its data-fetching effects against the newly
              selected academic year/term, without each page needing to know
              about the switcher. */}
          <div key={academicPeriodVersion}>{children}</div>
        </motion.main>
      </div>
    </div>
  );
};

export default Layout;
