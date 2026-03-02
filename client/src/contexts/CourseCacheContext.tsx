import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import type { ReactNode } from "react";
import { CourseApiService } from "../services/courseApi";
import type { Course } from "../types/course.types";

interface CourseCache {
  [courseId: number]: {
    data: Course;
    timestamp: number;
  };
}

interface PendingRequest {
  resolve: (value: Course | null) => void;
}

interface CourseCacheContextType {
  getCourse: (courseId: number) => Promise<Course | null>;
  clearCache: (courseId?: number) => void;
}

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache duration
const CourseCacheContext = createContext<CourseCacheContextType | undefined>(
  undefined,
);

export const CourseCacheProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const cacheRef = useRef<CourseCache>({});
  const pendingRequestsRef = useRef<{ [courseId: number]: PendingRequest[] }>(
    {},
  );
  const [, setRefresh] = useState(0);

  const clearCache = useCallback((courseId?: number) => {
    if (courseId) {
      delete cacheRef.current[courseId];
    } else {
      cacheRef.current = {};
    }
    setRefresh((prev) => prev + 1);
  }, []);

  const getCourse = useCallback(
    async (courseId: number): Promise<Course | null> => {
      // Check if cached data exists and is still valid
      const cached = cacheRef.current[courseId];
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }

      // If there's already a pending request for this course, wait for it
      if (pendingRequestsRef.current[courseId]?.length > 0) {
        return new Promise<Course | null>((resolve) => {
          pendingRequestsRef.current[courseId].push({ resolve });
        });
      }

      // Initialize pending requests array only if not already initialized
      if (!pendingRequestsRef.current[courseId]) {
        pendingRequestsRef.current[courseId] = [];
      }

      // Create a promise that will be resolved when the request completes
      const result = new Promise<Course | null>(async (resolve) => {
        try {
          const response = await CourseApiService.getCourse(courseId);

          if (response.success) {
            const courseData = response.data;

            // Update cache
            cacheRef.current[courseId] = {
              data: courseData,
              timestamp: Date.now(),
            };

            resolve(courseData);
          } else {
            resolve(null);
          }
        } catch (error) {
          console.error("Failed to fetch course:", error);
          resolve(null);
        } finally {
          // Resolve all pending requests
          const pending = pendingRequestsRef.current[courseId] || [];
          delete pendingRequestsRef.current[courseId];

          // Get the latest cached data (in case it was updated)
          const cachedData = cacheRef.current[courseId]?.data || null;

          pending.forEach(({ resolve }) => resolve(cachedData));
        }
      });

      return result;
    },
    [],
  );

  return (
    <CourseCacheContext.Provider value={{ getCourse, clearCache }}>
      {children}
    </CourseCacheContext.Provider>
  );
};

export const useCourseCache = (): CourseCacheContextType => {
  const context = useContext(CourseCacheContext);
  if (!context) {
    throw new Error("useCourseCache must be used within a CourseCacheProvider");
  }
  return context;
};
