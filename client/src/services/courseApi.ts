import axios from "../utils/axiosConfig";
import type {
  Course,
  CreateCourseRequest,
  UpdateCourseRequest,
} from "../types/course.types";
import type { Quiz } from "../types/quiz.types";

// Course API Service
export class CourseApiService {
  // Get all courses
  static async getCourses(): Promise<{
    success: boolean;
    count: number;
    data: Course[];
  }> {
    const response = await axios.get("/api/courses");
    return response.data;
  }

  // Get single course
  static async getCourse(
    courseId: number
  ): Promise<{ success: boolean; data: Course }> {
    const response = await axios.get(`/api/courses/${courseId}`);
    return response.data;
  }

  // Create course
  static async createCourse(
    courseData: CreateCourseRequest
  ): Promise<{ success: boolean; data: Course }> {
    const response = await axios.post("/api/courses", courseData);
    return response.data;
  }

  // Update course
  static async updateCourse(
    courseId: number,
    courseData: UpdateCourseRequest
  ): Promise<{ success: boolean; data: Course }> {
    const response = await axios.put(`/api/courses/${courseId}`, courseData);
    return response.data;
  }

  // Delete course
  static async deleteCourse(
    courseId: number
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.delete(`/api/courses/${courseId}`);
    return response.data;
  }

  // Get course students
  static async getCourseStudents(
    courseId: number
  ): Promise<{ success: boolean; data: any[] }> {
    const response = await axios.get(`/api/courses/${courseId}/students`);
    return response.data;
  }

  // Get course quizzes
  static async getCourseQuizzes(
    courseId: number
  ): Promise<{ success: boolean; count: number; data: Quiz[] }> {
    const response = await axios.get(`/api/courses/${courseId}/quizzes`);
    return response.data;
  }
}

// Error handling utility
export class CourseApiError extends Error {
  public statusCode: number;
  public errors?: any[];

  constructor(message: string, statusCode: number, errors?: any[]) {
    super(message);
    this.name = "CourseApiError";
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

// API response wrapper with error handling
export async function handleCourseApiCall<T>(
  apiCall: () => Promise<{
    success: boolean;
    data: T;
    message?: string;
    errors?: any[];
  }>
): Promise<T> {
  try {
    const response = await apiCall();

    if (!response.success) {
      throw new CourseApiError(
        response.message || "API call failed",
        400,
        response.errors
      );
    }

    return response.data;
  } catch (error: any) {
    if (error.response) {
      // Server responded with error status
      throw new CourseApiError(
        error.response.data.message || "Server error",
        error.response.status,
        error.response.data.errors
      );
    } else if (error.request) {
      // Network error
      throw new CourseApiError(
        "Network error - please check your connection",
        0
      );
    } else {
      // Other error
      throw new CourseApiError(error.message || "Unknown error occurred", 0);
    }
  }
}
