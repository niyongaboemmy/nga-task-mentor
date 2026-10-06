import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store";
import { fetchCourses } from "../store/slices/courseSlice";

/**
 * Course id → "CODE — Title" for the caller's courses (GET /courses, cached in
 * the course slice). The TMCode Projects API sends only course ids
 * (`course_ids`, `activity.course_id`), so pages name them from here.
 */
export function useCourseNames(): Map<number, string> {
  const dispatch = useDispatch<AppDispatch>();
  const courses = useSelector((state: RootState) => state.course?.courses ?? []);
  const loading = useSelector((state: RootState) => state.course?.loading?.courses ?? false);

  useEffect(() => {
    if (!courses.length && !loading) void dispatch(fetchCourses());
    // Once per mount: an empty list is a valid answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo(
    () => new Map(courses.map((c) => [Number(c.id), c.code ? `${c.code} — ${c.title}` : c.title])),
    [courses],
  );
}
