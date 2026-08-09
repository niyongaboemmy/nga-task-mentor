import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { ReactNode } from "react";
import { QuestionBankApiService } from "../services/quizApi";
import type { SchemeOfWorkEntry } from "../types/quiz.types";
import { onAcademicPeriodChanged } from "../utils/academicPeriodEvents";

// Keyed by course+class group+term -- entries genuinely differ per term, so
// keying by courseId alone (as before) served one term's entries back for
// another once cached, independent of any period-switch feature.
interface SchemeOfWorkCache {
  [cacheKey: string]: {
    entries: SchemeOfWorkEntry[];
    timestamp: number;
  };
}

const cacheKeyFor = (
  courseId: number,
  classGroupId: number,
  academicTermId: number,
) => `${courseId}:${classGroupId}:${academicTermId}`;

interface SchemeOfWorkContextType {
  getEntries: (
    courseId: number,
    classGroupId: number,
    academicTermId: number,
  ) => Promise<SchemeOfWorkEntry[]>;
  clearCache: () => void;
  isLoading: (
    courseId: number,
    classGroupId: number,
    academicTermId: number,
  ) => boolean;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache duration
const SchemeOfWorkContext = createContext<SchemeOfWorkContextType | undefined>(
  undefined,
);

export const SchemeOfWorkProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const cacheRef = useRef<SchemeOfWorkCache>({});
  const loadingRef = useRef<{ [cacheKey: string]: boolean }>({});
  const [, setRefresh] = useState(0); // Used to force re-render

  const isLoading = useCallback(
    (courseId: number, classGroupId: number, academicTermId: number) => {
      return (
        loadingRef.current[cacheKeyFor(courseId, classGroupId, academicTermId)] ||
        false
      );
    },
    [],
  );

  const clearCache = useCallback(() => {
    cacheRef.current = {};
    setRefresh((prev) => prev + 1);
  }, []);

  // Entries are fetched per term -- switching the viewed academic period
  // must drop everything cached under the old term.
  useEffect(() => onAcademicPeriodChanged(() => clearCache()), [clearCache]);

  const getEntries = useCallback(
    async (
      courseId: number,
      classGroupId: number,
      academicTermId: number,
    ): Promise<SchemeOfWorkEntry[]> => {
      const key = cacheKeyFor(courseId, classGroupId, academicTermId);

      // Check if cached data exists and is still valid
      const cached = cacheRef.current[key];
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.entries;
      }

      // Check if already loading
      if (loadingRef.current[key]) {
        // Wait for the existing request to complete
        return new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (!loadingRef.current[key]) {
              clearInterval(checkInterval);
              resolve(cacheRef.current[key]?.entries || []);
            }
          }, 100);
        });
      }

      // Set loading state
      loadingRef.current[key] = true;
      setRefresh((prev) => prev + 1);

      try {
        const response = await QuestionBankApiService.getSchemeOfWorkEntries(
          courseId,
          classGroupId,
          academicTermId,
        );

        if (response.success) {
          const raw = response.data;
          // API returns { scheme: {...}, entries: [...] }
          const entries: SchemeOfWorkEntry[] = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.entries)
              ? raw.entries
              : [];

          cacheRef.current[key] = {
            entries,
            timestamp: Date.now(),
          };

          return entries;
        }

        return [];
      } catch (error) {
        console.error("Failed to fetch scheme of work entries:", error);
        return [];
      } finally {
        loadingRef.current[key] = false;
        setRefresh((prev) => prev + 1);
      }
    },
    [],
  );

  return (
    <SchemeOfWorkContext.Provider value={{ getEntries, clearCache, isLoading }}>
      {children}
    </SchemeOfWorkContext.Provider>
  );
};

export const useSchemeOfWork = (): SchemeOfWorkContextType => {
  const context = useContext(SchemeOfWorkContext);
  if (!context) {
    throw new Error(
      "useSchemeOfWork must be used within a SchemeOfWorkProvider",
    );
  }
  return context;
};
