import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { BookOpen, CheckCircle2, Loader2, Search, X } from "lucide-react";
import api from "../../../utils/axiosConfig";
import { CourseApiService } from "../../../services/courseApi";
import type { Course } from "../../../types/course.types";

// ─── Student profile → Enroll in course ──────────────────────────────────────
// Lists every course the student isn't already in; the catalog is fetched on
// first open only.

interface Props {
  open: boolean;
  studentId: string;
  fullName: string;
  enrolledIds: string[];
  onClose: () => void;
  /** Called after a successful enrolment so the page can refresh its list. */
  onEnrolled: () => Promise<void> | void;
}

export default function EnrollCoursesModal({ open, studentId, fullName, enrolledIds, onClose, onEnrolled }: Props) {
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourseIds, setSelectedCourseIds] = useState<number[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  const loadCatalog = useCallback(async () => {
    if (allCourses.length > 0) return;
    setCatalogLoading(true);
    try {
      const res = await CourseApiService.getCourses();
      setAllCourses(res.data ?? []);
    } catch {
      toast.error("Failed to load the course catalog.");
    } finally {
      setCatalogLoading(false);
    }
  }, [allCourses.length]);

  useEffect(() => {
    if (open) loadCatalog();
  }, [open, loadCatalog]);

  const availableCourses = useMemo(() => {
    const enrolled = new Set(enrolledIds);
    const unenrolled = allCourses.filter((c) => !enrolled.has(String(c.id)));
    if (!searchTerm.trim()) return unenrolled;
    const q = searchTerm.toLowerCase();
    return unenrolled.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q),
    );
  }, [allCourses, enrolledIds, searchTerm]);

  const handleCourseSelection = (courseId: number) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    );
  };

  const closeEnrollModal = () => {
    setSelectedCourseIds([]);
    setSearchTerm("");
    onClose();
  };

  const handleAssignCourses = async () => {
    if (selectedCourseIds.length === 0) return;
    setIsAssigning(true);
    try {
      await Promise.all(
        selectedCourseIds.map((courseId) =>
          api.post(`/courses/${courseId}/enroll-students`, { studentIds: [studentId] }),
        ),
      );
      await onEnrolled();
      toast.success(
        selectedCourseIds.length === 1
          ? "Course assigned successfully!"
          : `${selectedCourseIds.length} courses assigned successfully!`,
      );
      closeEnrollModal();
    } catch (error) {
      console.error("Error assigning courses:", error);
      toast.error("Failed to assign courses. Please try again.");
    } finally {
      setIsAssigning(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" onClick={closeEnrollModal} />

      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden border border-white/20 dark:border-gray-700/40 flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-light dark:border-gray-700/40 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">Enroll in Course</h2>
            <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60 mt-0.5">
              Assign {fullName || "this student"} to one or more courses.
            </p>
          </div>
          <button
            onClick={closeEnrollModal}
            aria-label="Close"
            className="p-1.5 rounded-lg hover:bg-surface-light dark:hover:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark/60 hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-border-light dark:border-gray-700/40 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search by course title, code, or description…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-sm text-text-primary-light dark:text-text-primary-dark placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {catalogLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
            </div>
          ) : availableCourses.length === 0 ? (
            <div className="text-center py-14">
              <BookOpen className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-700 mb-3" />
              <h3 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">No courses found</h3>
              <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark/60">
                {searchTerm ? `No courses match "${searchTerm}"` : "No available courses to assign — the student may already be enrolled in everything."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableCourses.map((course) => {
                const selected = selectedCourseIds.includes(course.id);
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => handleCourseSelection(course.id)}
                    className={`text-left relative rounded-2xl p-4 border-2 transition-all ${
                      selected
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/30"
                        : "border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${selected ? "bg-blue-600" : "bg-gray-100 dark:bg-gray-700"}`}>
                        {selected ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : (
                          <BookOpen className="w-5 h-5 text-text-secondary-light dark:text-text-secondary-dark/60" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark line-clamp-1">{course.title}</h4>
                        <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark line-clamp-2 mt-0.5">{course.description}</p>
                        <span className="inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-text-secondary-light dark:text-text-secondary-dark">
                          {course.code}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border-light dark:border-gray-700/40 bg-surface-light/60 dark:bg-gray-950/40 flex-shrink-0">
          <span className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            {selectedCourseIds.length} course{selectedCourseIds.length !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={closeEnrollModal}
              className="px-5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAssignCourses}
              disabled={selectedCourseIds.length === 0 || isAssigning}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isAssigning && <Loader2 className="w-4 h-4 animate-spin" />}
              {isAssigning ? "Assigning…" : `Assign${selectedCourseIds.length > 0 ? ` (${selectedCourseIds.length})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
