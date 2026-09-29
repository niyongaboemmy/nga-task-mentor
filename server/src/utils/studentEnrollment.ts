import axios from "axios";
import { Request } from "express";
import { getMisToken, resolveAcademicYearId } from "./misUtils";

/**
 * The MIS subjects (Task Mentor course ids) the signed-in student is enrolled
 * in for the current academic year.
 *
 * Returns null when enrollment can't be determined (no MIS link/token, or
 * the MIS is unreachable) so callers can decide how strict to be; a 401 from
 * the MIS is re-thrown for `handleMisError`.
 */
export async function getStudentEnrolledCourseIds(req: Request): Promise<number[] | null> {
  const token = getMisToken(req);
  if (!token || !req.user?.mis_user_id) return null;
  try {
    const yearId = await resolveAcademicYearId(req);
    const res = await axios.get(
      `${process.env.NGA_MIS_BASE_URL}/academics/students/${req.user.mis_user_id}/enrolled-subjects`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: yearId ? { academic_year_id: yearId } : {},
      },
    );
    if (res.data?.success && Array.isArray(res.data?.data)) {
      return res.data.data.map((s: any) => Number(s.id));
    }
    return null;
  } catch (error: any) {
    if (error?.response?.status === 401) throw error;
    console.error("Could not load MIS enrollments:", error?.message);
    return null;
  }
}

/**
 * Whether a student may take a (non-public) quiz. Denies only when the MIS
 * positively says the student isn't in the course; if enrollment can't be
 * determined the attempt is allowed (and logged) rather than blocking a
 * whole class during an MIS outage.
 */
export async function studentMayTakeQuiz(req: Request, quiz: any): Promise<boolean> {
  if (quiz?.is_public) return true;
  const ids = await getStudentEnrolledCourseIds(req);
  if (ids === null) return true;
  return ids.includes(Number(quiz.course_id));
}
