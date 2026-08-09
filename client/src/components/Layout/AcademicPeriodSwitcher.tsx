import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../contexts/AuthContext";
import { getAcademicTerms, getAcademicYears } from "../../services/authService";
import type { AcademicTerm, AcademicYear } from "../../types/user.types";

interface AcademicPeriodSwitcherProps {
  /** Compact pill for the desktop nav vs. a full-width button for mobile */
  variant?: "pill" | "full";
}

const AcademicPeriodSwitcher: React.FC<AcademicPeriodSwitcherProps> = ({
  variant = "pill",
}) => {
  const { user, switchAcademicPeriod } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [termsByYear, setTermsByYear] = useState<Record<number, AcademicTerm[]>>({});
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingTermsForYear, setLoadingTermsForYear] = useState<number | null>(null);
  const [switchingTermId, setSwitchingTermId] = useState<number | null>(null);
  const [activeYearId, setActiveYearId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedYear = user?.currentAcademicYear as AcademicYear | undefined;
  const selectedTerm = user?.currentAcademicTerm as AcademicTerm | undefined;

  // Close on outside click / Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  const loadYears = async () => {
    if (years.length > 0) return;
    setLoadingYears(true);
    try {
      const data = await getAcademicYears();
      // Most recent first, current year floated to top
      const sorted = [...data].sort((a, b) => {
        if (a.is_current !== b.is_current) return b.is_current - a.is_current;
        return b.start_date.localeCompare(a.start_date);
      });
      setYears(sorted);
    } catch (err) {
      console.error("Failed to load academic years:", err);
      toast.error("Could not load academic years");
    } finally {
      setLoadingYears(false);
    }
  };

  const loadTermsForYear = async (yearId: number) => {
    if (termsByYear[yearId]) return;
    setLoadingTermsForYear(yearId);
    try {
      const data = await getAcademicTerms(yearId);
      setTermsByYear((prev) => ({ ...prev, [yearId]: data }));
    } catch (err) {
      console.error("Failed to load academic terms:", err);
      toast.error("Could not load academic terms");
    } finally {
      setLoadingTermsForYear(null);
    }
  };

  const handleOpen = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      const yearId = selectedYear?.academic_year_id ?? null;
      setActiveYearId(yearId);
      loadYears();
      if (yearId) loadTermsForYear(yearId);
    }
  };

  const handleYearClick = (yearId: number) => {
    setActiveYearId(yearId);
    loadTermsForYear(yearId);
  };

  const handleTermClick = async (year: AcademicYear, term: AcademicTerm) => {
    if (term.academic_term_id === selectedTerm?.academic_term_id) {
      setIsOpen(false);
      return;
    }
    setSwitchingTermId(term.academic_term_id);
    try {
      await switchAcademicPeriod(year.academic_year_id, term.academic_term_id);
      toast.success(`Switched to ${year.name} · ${term.name}`);
      setIsOpen(false);
    } catch (err) {
      console.error("Failed to switch academic period:", err);
      toast.error("Could not switch academic period. Please try again.");
    } finally {
      setSwitchingTermId(null);
    }
  };

  const activeYearTerms = activeYearId ? termsByYear[activeYearId] : undefined;

  if (!selectedYear || !selectedTerm) return null;

  const triggerLabel = (
    <>
      <span className="font-semibold">{selectedYear.name}</span>
      <span className="w-1 h-1 rounded-full bg-current opacity-40" />
      <span>{selectedTerm.name}</span>
    </>
  );

  return (
    <div className="relative" ref={containerRef}>
      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleOpen}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={
          variant === "pill"
            ? "flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-400 rounded-full text-xs font-medium border border-gray-200 dark:border-gray-700/40 hover:border-blue-200 dark:hover:border-blue-800/50 transition-all duration-200"
            : "w-full flex items-center justify-between gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-100 dark:border-blue-800/50"
        }
        title="Switch academic year / term"
      >
        <span className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          {triggerLabel}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-[340px] max-w-[90vw] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-30 overflow-hidden"
            role="menu"
          >
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Academic year & term
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Data across the app will refresh for the period you pick.
              </p>
            </div>

            <div className="flex max-h-80">
              {/* Years column */}
              <div className="w-1/2 border-r border-gray-100 dark:border-gray-700/60 overflow-y-auto py-2">
                {loadingYears && years.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : (
                  years.map((year) => {
                    const isActive = year.academic_year_id === activeYearId;
                    const isCurrentPeriod =
                      year.academic_year_id === selectedYear.academic_year_id;
                    return (
                      <button
                        key={year.academic_year_id}
                        type="button"
                        onClick={() => handleYearClick(year.academic_year_id)}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors duration-150 ${
                          isActive
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        }`}
                        role="menuitem"
                      >
                        <span className="truncate">{year.name}</span>
                        {!!year.is_current && (
                          <span className="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                            Now
                          </span>
                        )}
                        {isCurrentPeriod && !year.is_current && (
                          <Check className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Terms column */}
              <div className="w-1/2 overflow-y-auto py-2">
                {loadingTermsForYear === activeYearId ? (
                  <div className="flex items-center justify-center py-8 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : !activeYearTerms || activeYearTerms.length === 0 ? (
                  <p className="text-xs text-gray-400 px-3 py-4 text-center">
                    No terms found
                  </p>
                ) : (
                  activeYearTerms.map((term) => {
                    const isSelected =
                      term.academic_term_id === selectedTerm.academic_term_id;
                    const isSwitching = switchingTermId === term.academic_term_id;
                    const activeYear = years.find((y) => y.academic_year_id === activeYearId)!;
                    return (
                      <button
                        key={term.academic_term_id}
                        type="button"
                        disabled={switchingTermId !== null}
                        onClick={() => handleTermClick(activeYear, term)}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors duration-150 disabled:opacity-60 disabled:cursor-wait ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        }`}
                        role="menuitem"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          {term.name}
                          {!!term.is_current && (
                            <span className="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">
                              Now
                            </span>
                          )}
                        </span>
                        {isSwitching ? (
                          <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-blue-500" />
                        ) : (
                          isSelected && (
                            <Check className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                          )
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AcademicPeriodSwitcher;
