import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { CourseApiService } from "../services/courseApi";
import type { Course } from "../types/course.types";
import {
  ArrowLeft,
  Library,
  LayoutDashboard,
  ChevronRight,
} from "lucide-react";
import QuestionBankView from "../components/QuestionBank/QuestionBankView";
import type { RootState } from "../store";

const QuestionBankPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const courseIdNum = parseInt(courseId!);

  // Get course from store if available
  const storeCourse = useSelector(
    (state: RootState) =>
      state.course.courses.find((c) => c.id === courseIdNum) ||
      state.course.currentCourse,
  );

  const [course, setCourse] = useState<Course | null>(storeCourse || null);

  useEffect(() => {
    if (!course) {
      CourseApiService.getCourse(courseIdNum)
        .then((res) => setCourse(res.data))
        .catch((err) => console.error("Failed to fetch course:", err));
    }
  }, [courseIdNum, course]);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto space-y-2">
        {/* Navigation Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-gray-900/50 backdrop-blur-xl border border-gray-200/60 dark:border-gray-800/30 p-4 rounded-3xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/courses/${courseId}`)}
              className="p-2.5 rounded-2xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-all hover:scale-105 active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                <span
                  className="hover:text-blue-600 cursor-pointer transition-colors"
                  onClick={() => navigate("/courses")}
                >
                  Courses
                </span>
                <ChevronRight className="w-3 h-3" />
                <span
                  className="hover:text-blue-600 cursor-pointer transition-colors"
                  onClick={() => navigate(`/courses/${courseId}`)}
                >
                  {course?.code || `Course ${courseId}`}
                </span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-gray-900 dark:text-white">
                  Question Bank
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 truncate">
                <Library className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                <span className="truncate">Question Bank</span>
                {course && (
                  <div className="text-sm">
                    <span className="text-gray-300 dark:text-gray-700 font-light mx-1">
                      |
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium truncate">
                      {course.code}
                    </span>
                    <span className="text-gray-500 dark:text-gray-200 font-normal truncate hidden sm:inline">
                      - {course.title}
                    </span>
                  </div>
                )}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/courses/${courseId}`)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/40 rounded-2xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
              <LayoutDashboard className="w-4 h-4" />
              Course Dashboard
            </button>
          </div>
        </div>

        {/* Main Content Card */}
        <QuestionBankView courseId={courseIdNum} />
      </div>
    </div>
  );
};

export default QuestionBankPage;
