import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";
import {
  CourseApiService,
  handleCourseApiCall,
} from "../../services/courseApi";
import type {
  Course,
  CreateCourseRequest,
  UpdateCourseRequest,
} from "../../types/course.types";
import type { Quiz } from "../../types/quiz.types";

// Async thunks for API calls
export const fetchCourses = createAsyncThunk(
  "course/fetchCourses",
  async (_, { rejectWithValue }) => {
    try {
      return await handleCourseApiCall(() => CourseApiService.getCourses());
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchCourse = createAsyncThunk(
  "course/fetchCourse",
  async (courseId: number, { rejectWithValue }) => {
    try {
      return await handleCourseApiCall(() =>
        CourseApiService.getCourse(courseId),
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const fetchCourseQuizzes = createAsyncThunk(
  "course/fetchCourseQuizzes",
  async (courseId: number, { rejectWithValue }) => {
    try {
      return await handleCourseApiCall(() =>
        CourseApiService.getCourseQuizzes(courseId),
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const createCourse = createAsyncThunk(
  "course/createCourse",
  async (courseData: CreateCourseRequest, { rejectWithValue }) => {
    try {
      return await handleCourseApiCall(() =>
        CourseApiService.createCourse(courseData),
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const updateCourse = createAsyncThunk(
  "course/updateCourse",
  async (
    {
      courseId,
      courseData,
    }: { courseId: number; courseData: UpdateCourseRequest },
    { rejectWithValue },
  ) => {
    try {
      return await handleCourseApiCall(() =>
        CourseApiService.updateCourse(courseId, courseData),
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

export const deleteCourse = createAsyncThunk(
  "course/deleteCourse",
  async (courseId: number, { rejectWithValue }) => {
    try {
      await handleCourseApiCall(() => CourseApiService.deleteCourse(courseId));
      return courseId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  },
);

// Course slice state interface
interface CourseState {
  courses: Course[];
  currentCourse: Course | null;
  courseQuizzes: Quiz[];
  loading: {
    courses: boolean;
    course: boolean;
    courseQuizzes: boolean;
  };
  error: {
    courses: string | null;
    course: string | null;
    courseQuizzes: string | null;
  };
}

const initialState: CourseState = {
  courses: [],
  currentCourse: null,
  courseQuizzes: [],
  loading: {
    courses: false,
    course: false,
    courseQuizzes: false,
  },
  error: {
    courses: null,
    course: null,
    courseQuizzes: null,
  },
};

const courseSlice = createSlice({
  name: "course",
  initialState,
  reducers: {
    clearCourseError: (
      state,
      action: PayloadAction<keyof CourseState["error"]>,
    ) => {
      state.error[action.payload] = null;
    },
    clearCurrentCourse: (state) => {
      state.currentCourse = null;
    },
    resetCourseState: (_state) => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    // Fetch courses
    builder
      .addCase(fetchCourses.pending, (state) => {
        state.loading.courses = true;
        state.error.courses = null;
      })
      .addCase(fetchCourses.fulfilled, (state, action) => {
        state.loading.courses = false;
        state.courses = action.payload || [];
        state.error.courses = null;
      })
      .addCase(fetchCourses.rejected, (state, action) => {
        state.loading.courses = false;
        state.error.courses = action.payload as string;
      });

    // Fetch single course
    builder
      .addCase(fetchCourse.pending, (state) => {
        state.loading.course = true;
        state.error.course = null;
      })
      .addCase(fetchCourse.fulfilled, (state, action) => {
        state.loading.course = false;
        const index = state.courses.findIndex(
          (c) => String(c.id) === String(action.payload.id),
        );
        if (index !== -1) {
          state.courses[index] = { ...state.courses[index], ...action.payload };
          state.currentCourse = state.courses[index];
        } else {
          state.currentCourse = action.payload;
        }
        state.error.course = null;
      })
      .addCase(fetchCourse.rejected, (state, action) => {
        state.loading.course = false;
        state.error.course = action.payload as string;
      });

    // Fetch course quizzes
    builder
      .addCase(fetchCourseQuizzes.pending, (state) => {
        state.loading.courseQuizzes = true;
        state.error.courseQuizzes = null;
      })
      .addCase(fetchCourseQuizzes.fulfilled, (state, action) => {
        state.loading.courseQuizzes = false;
        state.courseQuizzes = action.payload;
        state.error.courseQuizzes = null;
      })
      .addCase(fetchCourseQuizzes.rejected, (state, action) => {
        state.loading.courseQuizzes = false;
        state.error.courseQuizzes = action.payload as string;
      });

    // Create course
    builder
      .addCase(createCourse.pending, (state) => {
        state.loading.course = true;
        state.error.course = null;
      })
      .addCase(createCourse.fulfilled, (state, action) => {
        state.loading.course = false;
        state.courses.push(action.payload);
        state.error.course = null;
      })
      .addCase(createCourse.rejected, (state, action) => {
        state.loading.course = false;
        state.error.course = action.payload as string;
      });

    // Update course
    builder.addCase(updateCourse.fulfilled, (state, action) => {
      const index = state.courses.findIndex((c) => c.id === action.payload.id);
      if (index !== -1) {
        state.courses[index] = action.payload;
      }
      if (state.currentCourse?.id === action.payload.id) {
        state.currentCourse = action.payload;
      }
    });

    // Delete course
    builder.addCase(deleteCourse.fulfilled, (state, action) => {
      state.courses = state.courses.filter((c) => c.id !== action.payload);
      if (state.currentCourse?.id === action.payload) {
        state.currentCourse = null;
      }
    });
  },
});

export const { clearCourseError, clearCurrentCourse, resetCourseState } =
  courseSlice.actions;

export default courseSlice.reducer;
