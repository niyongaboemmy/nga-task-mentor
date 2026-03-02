import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import type { ReactNode } from "react";
import { QuestionBankApiService } from "../services/quizApi";
import type { SchemeOfWorkEntry } from "../types/quiz.types";

interface SchemeOfWorkCache {
  [courseId: number]: {
    entries: SchemeOfWorkEntry[];
    timestamp: number;
  };
}

interface SchemeOfWorkContextType {
  getEntries: (
    courseId: number,
    classGroupId: number,
    academicTermId: number,
  ) => Promise<SchemeOfWorkEntry[]>;
  clearCache: (courseId?: number) => void;
  isLoading: (courseId: number) => boolean;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache duration
const SchemeOfWorkContext = createContext<SchemeOfWorkContextType | undefined>(
  undefined,
);

export const SchemeOfWorkProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const cacheRef = useRef<SchemeOfWorkCache>({});
  const loadingRef = useRef<{ [courseId: number]: boolean }>({});
  const [, setRefresh] = useState(0); // Used to force re-render

  const isLoading = useCallback((courseId: number) => {
    return loadingRef.current[courseId] || false;
  }, []);

  const clearCache = useCallback((courseId?: number) => {
    if (courseId) {
      delete cacheRef.current[courseId];
    } else {
      cacheRef.current = {};
    }
    setRefresh((prev) => prev + 1);
  }, []);

  const getEntries = useCallback(
    async (
      courseId: number,
      classGroupId: number,
      academicTermId: number,
    ): Promise<SchemeOfWorkEntry[]> => {
      // Check if cached data exists and is still valid
      const cached = cacheRef.current[courseId];
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.entries;
      }

      // Check if already loading
      if (loadingRef.current[courseId]) {
        // Wait for the existing request to complete
        return new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (!loadingRef.current[courseId]) {
              clearInterval(checkInterval);
              resolve(cacheRef.current[courseId]?.entries || []);
            }
          }, 100);
        });
      }

      // Set loading state
      loadingRef.current[courseId] = true;
      setRefresh((prev) => prev + 1);

      try {
        const response = await QuestionBankApiService.getSchemeOfWorkEntries(
          courseId,
          classGroupId,
          academicTermId,
        );

        if (response.success) {
          const entries = response.data;

          // Update cache using ref
          cacheRef.current[courseId] = {
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
        loadingRef.current[courseId] = false;
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
