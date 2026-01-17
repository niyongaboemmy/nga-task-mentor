import {
  createSlice,
  createAsyncThunk,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { QuizApiService, handleQuizApiCall } from "../../services/quizApi";
import type {
  Quiz,
  QuizQuestion,
  CreateQuizRequest,
  UpdateQuizRequest,
  CreateQuestionRequest,
  QuizAnalytics,
  AnswerDataType,
} from "../../types/quiz.types";

// Async thunks for API calls
export const fetchQuizzes = createAsyncThunk(
  "quiz/fetchQuizzes",
  async (courseId: number, { rejectWithValue }) => {
    try {
      return await handleQuizApiCall(() => QuizApiService.getQuizzes(courseId));
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchQuiz = createAsyncThunk(
  "quiz/fetchQuiz",
  async (quizId: number, { rejectWithValue }) => {
    try {
      return await handleQuizApiCall(() => QuizApiService.getQuiz(quizId));
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const createQuiz = createAsyncThunk(
  "quiz/createQuiz",
  async (quizData: CreateQuizRequest, { rejectWithValue }) => {
    try {
      return await handleQuizApiCall(() => QuizApiService.createQuiz(quizData));
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateQuiz = createAsyncThunk(
  "quiz/updateQuiz",
  async (
    { quizId, quizData }: { quizId: number; quizData: UpdateQuizRequest },
    { rejectWithValue }
  ) => {
    try {
      return await handleQuizApiCall(() =>
        QuizApiService.updateQuiz(quizId, quizData)
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteQuiz = createAsyncThunk(
  "quiz/deleteQuiz",
  async (quizId: number, { rejectWithValue }) => {
    try {
      await handleQuizApiCall(() => QuizApiService.deleteQuiz(quizId));
      return quizId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchQuizStats = createAsyncThunk(
  "quiz/fetchQuizStats",
  async (quizId: number, { rejectWithValue }) => {
    try {
      return await handleQuizApiCall(() => QuizApiService.getQuizStats(quizId));
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Question management thunks
export const fetchQuizQuestions = createAsyncThunk(
  "quiz/fetchQuizQuestions",
  async (quizId: number, { rejectWithValue }) => {
    try {
      return await handleQuizApiCall(() =>
        QuizApiService.getQuizQuestions(quizId)
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const createQuestion = createAsyncThunk(
  "quiz/createQuestion",
  async (
    {
      quizId,
      questionData,
    }: { quizId: number; questionData: CreateQuestionRequest },
    { rejectWithValue }
  ) => {
    try {
      return await handleQuizApiCall(() =>
        QuizApiService.createQuestion(quizId, questionData)
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateQuestion = createAsyncThunk(
  "quiz/updateQuestion",
  async (
    {
      questionId,
      questionData,
    }: { questionId: number; questionData: Partial<CreateQuestionRequest> },
    { rejectWithValue }
  ) => {
    try {
      return await handleQuizApiCall(() =>
        QuizApiService.updateQuestion(questionId, questionData)
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteQuestion = createAsyncThunk(
  "quiz/deleteQuestion",
  async (questionId: number, { rejectWithValue }) => {
    try {
      await handleQuizApiCall(() => QuizApiService.deleteQuestion(questionId));
      return questionId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const reorderQuestions = createAsyncThunk(
  "quiz/reorderQuestions",
  async (
    {
      quizId,
      questionOrders,
    }: {
      quizId: number;
      questionOrders: Array<{ id: number; order: number }>;
    },
    { rejectWithValue }
  ) => {
    try {
      return await handleQuizApiCall(() =>
        QuizApiService.reorderQuestions(quizId, questionOrders)
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Quiz taking thunks
export const fetchAvailableQuizzes = createAsyncThunk(
  "quiz/fetchAvailableQuizzes",
  async (_, { rejectWithValue }) => {
    try {
      return await handleQuizApiCall(() =>
        QuizApiService.getAvailableQuizzes()
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchPublicQuizzes = createAsyncThunk(
  "quiz/fetchPublicQuizzes",
  async (_, { rejectWithValue }) => {
    try {
      return await handleQuizApiCall(() => QuizApiService.getPublicQuizzes());
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const startQuizAttempt = createAsyncThunk(
  "quiz/startQuizAttempt",
  async (quizId: number, { rejectWithValue }) => {
    try {
      return await handleQuizApiCall(() =>
        QuizApiService.startQuizAttempt(quizId)
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const submitQuestionAnswer = createAsyncThunk(
  "quiz/submitQuestionAnswer",
  async (
    {
      submissionId,
      questionId,
      answerData,
    }: {
      submissionId: number;
      questionId: number;
      answerData: AnswerDataType;
    },
    { rejectWithValue }
  ) => {
    try {
      return await handleQuizApiCall(() =>
        QuizApiService.submitQuestionAnswer(
          submissionId,
          questionId,
          answerData
        )
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const submitQuiz = createAsyncThunk(
  "quiz/submitQuiz",
  async (submissionId: number, { rejectWithValue }) => {
    try {
      return await handleQuizApiCall(() =>
        QuizApiService.submitQuiz(submissionId)
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchQuizResults = createAsyncThunk(
  "quiz/fetchQuizResults",
  async (submissionId: number, { rejectWithValue }) => {
    try {
      return await handleQuizApiCall(() =>
        QuizApiService.getQuizResults(submissionId)
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Grading thunks
export const fetchPendingSubmissions = createAsyncThunk(
  "quiz/fetchPendingSubmissions",
  async ({ courseId }: { courseId?: number }, { rejectWithValue }) => {
    try {
      return await handleQuizApiCall(() =>
        QuizApiService.getPendingSubmissions(courseId)
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchSubmissionForGrading = createAsyncThunk(
  "quiz/fetchSubmissionForGrading",
  async (submissionId: number, { rejectWithValue }) => {
    try {
      return await handleQuizApiCall(() =>
        QuizApiService.getSubmissionForGrading(submissionId)
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const gradeSubmission = createAsyncThunk(
  "quiz/gradeSubmission",
  async (
    {
      submissionId,
      grades,
      feedback,
    }: {
      submissionId: number;
      grades: Record<number, number>;
      feedback?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      return await handleQuizApiCall(() =>
        QuizApiService.gradeSubmission(submissionId, grades, feedback)
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchQuestion = createAsyncThunk(
  "quiz/fetchQuestion",
  async (questionId: number, { rejectWithValue }) => {
    try {
      return await handleQuizApiCall(() =>
        QuizApiService.getQuestion(questionId)
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchQuizAnalytics = createAsyncThunk(
  "quiz/fetchQuizAnalytics",
  async (quizId: number, { rejectWithValue }) => {
    try {
      return await handleQuizApiCall(() =>
        QuizApiService.getQuizAnalytics(quizId)
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchQuizAttemptStatus = createAsyncThunk(
  "quiz/fetchQuizAttemptStatus",
  async (submissionId: number, { rejectWithValue }) => {
    try {
      return await handleQuizApiCall(() =>
        QuizApiService.getQuizAttemptStatus(submissionId)
      );
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// Quiz slice state interface
interface QuizState {
  // Quiz management
  quizzes: Quiz[];
  currentQuiz: Quiz | null;
  quizStats: any | null;

  // Question management
  questions: QuizQuestion[];
  currentQuestion: QuizQuestion | null;

  // Quiz taking
  availableQuizzes: Quiz[];
  publicQuizzes: Quiz[];
  currentSubmission: any | null;
  quizResults: any | null;

  // Grading
  pendingSubmissions: any[];
  submissionForGrading: any | null;

  // Analytics
  analytics: QuizAnalytics | null;

  // Loading states
  loading: {
    quizzes: boolean;
    quiz: boolean;
    questions: boolean;
    submission: boolean;
    grading: boolean;
    analytics: boolean;
  };

  // Error states
  error: {
    quizzes: string | null;
    quiz: string | null;
    questions: string | null;
    submission: string | null;
    grading: string | null;
    analytics: string | null;
  };
}

const initialState: QuizState = {
  quizzes: [],
  currentQuiz: null,
  quizStats: null,
  questions: [],
  currentQuestion: null,
  availableQuizzes: [],
  publicQuizzes: [],
  currentSubmission: null,
  quizResults: null,
  pendingSubmissions: [],
  submissionForGrading: null,
  analytics: null,
  loading: {
    quizzes: false,
    quiz: false,
    questions: false,
    submission: false,
    grading: false,
    analytics: false,
  },
  error: {
    quizzes: null,
    quiz: null,
    questions: null,
    submission: null,
    grading: null,
    analytics: null,
  },
};

const quizSlice = createSlice({
  name: "quiz",
  initialState,
  reducers: {
    clearQuizError: (
      state,
      action: PayloadAction<keyof QuizState["error"]>
    ) => {
      state.error[action.payload] = null;
    },
    clearCurrentQuiz: (state) => {
      state.currentQuiz = null;
      state.questions = [];
      state.currentQuestion = null;
      state.quizStats = null;
    },
    clearCurrentSubmission: (state) => {
      state.currentSubmission = null;
      state.quizResults = null;
    },
    setCurrentQuestion: (state, action: PayloadAction<QuizQuestion>) => {
      state.currentQuestion = action.payload;
    },
    resetQuizState: (_state) => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    // Fetch quizzes
    builder
      .addCase(fetchQuizzes.pending, (state) => {
        state.loading.quizzes = true;
        state.error.quizzes = null;
      })
      .addCase(fetchQuizzes.fulfilled, (state, action) => {
        state.loading.quizzes = false;
        state.quizzes = action.payload;
        state.error.quizzes = null;
      })
      .addCase(fetchQuizzes.rejected, (state, action) => {
        state.loading.quizzes = false;
        state.error.quizzes = action.payload as string;
      });

    // Fetch single quiz
    builder
      .addCase(fetchQuiz.pending, (state) => {
        state.loading.quiz = true;
        state.error.quiz = null;
      })
      .addCase(fetchQuiz.fulfilled, (state, action) => {
        state.loading.quiz = false;
        state.currentQuiz = action.payload;
        state.error.quiz = null;
      })
      .addCase(fetchQuiz.rejected, (state, action) => {
        state.loading.quiz = false;
        state.error.quiz = action.payload as string;
      });

    // Create quiz
    builder
      .addCase(createQuiz.pending, (state) => {
        state.loading.quiz = true;
        state.error.quiz = null;
      })
      .addCase(createQuiz.fulfilled, (state, action) => {
        state.loading.quiz = false;
        state.quizzes.push(action.payload);
        state.error.quiz = null;
      })
      .addCase(createQuiz.rejected, (state, action) => {
        state.loading.quiz = false;
        state.error.quiz = action.payload as string;
      });

    // Update quiz
    builder.addCase(updateQuiz.fulfilled, (state, action) => {
      const index = state.quizzes.findIndex((q) => q.id === action.payload.id);
      if (index !== -1) {
        state.quizzes[index] = action.payload;
      }
      if (state.currentQuiz?.id === action.payload.id) {
        state.currentQuiz = action.payload;
      }
    });

    // Delete quiz
    builder.addCase(deleteQuiz.fulfilled, (state, action) => {
      state.quizzes = state.quizzes.filter((q) => q.id !== action.payload);
      if (state.currentQuiz?.id === action.payload) {
        state.currentQuiz = null;
      }
    });

    // Fetch quiz questions
    builder
      .addCase(fetchQuizQuestions.pending, (state) => {
        state.loading.questions = true;
        state.error.questions = null;
      })
      .addCase(fetchQuizQuestions.fulfilled, (state, action) => {
        state.loading.questions = false;
        state.questions = action.payload;
        state.error.questions = null;
      })
      .addCase(fetchQuizQuestions.rejected, (state, action) => {
        state.loading.questions = false;
        state.error.questions = action.payload as string;
      });

    // Create question
    builder.addCase(createQuestion.fulfilled, (state, action) => {
      state.questions.push(action.payload);
    });

    // Update question
    builder.addCase(updateQuestion.fulfilled, (state, action) => {
      const index = state.questions.findIndex(
        (q) => q.id === action.payload.id
      );
      if (index !== -1) {
        state.questions[index] = action.payload;
      }
      if (state.currentQuestion?.id === action.payload.id) {
        state.currentQuestion = action.payload;
      }
    });

    // Delete question
    builder.addCase(deleteQuestion.fulfilled, (state, action) => {
      state.questions = state.questions.filter((q) => q.id !== action.payload);
      if (state.currentQuestion?.id === action.payload) {
        state.currentQuestion = null;
      }
    });

    // Reorder questions
    builder.addCase(reorderQuestions.fulfilled, (state, action) => {
      state.questions = action.payload;
    });

    // Quiz taking
    builder
      .addCase(fetchAvailableQuizzes.fulfilled, (state, action) => {
        state.availableQuizzes = action.payload;
      })
      .addCase(fetchPublicQuizzes.fulfilled, (state, action) => {
        state.publicQuizzes = action.payload;
      })
      .addCase(startQuizAttempt.fulfilled, (state, action) => {
        state.currentSubmission = action.payload;
      });

    // Grading
    builder
      .addCase(fetchPendingSubmissions.fulfilled, (state, action) => {
        state.pendingSubmissions = action.payload;
      })
      .addCase(fetchSubmissionForGrading.fulfilled, (state, action) => {
        state.submissionForGrading = action.payload;
      });

    // Analytics
    builder
      .addCase(fetchQuizAnalytics.pending, (state) => {
        state.loading.analytics = true;
        state.error.analytics = null;
      })
      .addCase(fetchQuizAnalytics.fulfilled, (state, action) => {
        state.loading.analytics = false;
        state.analytics = action.payload;
        state.error.analytics = null;
      })
      .addCase(fetchQuizAnalytics.rejected, (state, action) => {
        state.loading.analytics = false;
        state.error.analytics = action.payload as string;
      });

    // Fetch single question
    builder
      .addCase(fetchQuestion.pending, (state) => {
        state.loading.questions = true;
        state.error.questions = null;
      })
      .addCase(fetchQuestion.fulfilled, (state, action) => {
        state.loading.questions = false;
        state.currentQuestion = action.payload;
        state.error.questions = null;
      })
      .addCase(fetchQuestion.rejected, (state, action) => {
        state.loading.questions = false;
        state.error.questions = action.payload as string;
      });

    // Fetch quiz attempt status
    builder
      .addCase(fetchQuizAttemptStatus.pending, (state) => {
        state.loading.submission = true;
        state.error.submission = null;
      })
      .addCase(fetchQuizAttemptStatus.fulfilled, (state, action) => {
        state.loading.submission = false;
        state.currentSubmission = action.payload;
        state.error.submission = null;
      })
      .addCase(fetchQuizAttemptStatus.rejected, (state, action) => {
        state.loading.submission = false;
        state.error.submission = action.payload as string;
      });
  },
});

export const {
  clearQuizError,
  clearCurrentQuiz,
  clearCurrentSubmission,
  setCurrentQuestion,
  resetQuizState,
} = quizSlice.actions;

export default quizSlice.reducer;
