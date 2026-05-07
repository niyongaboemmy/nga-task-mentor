import axios from "../utils/axiosConfig";
import type {
  Quiz,
  QuizQuestion,
  QuestionBankEntry,
  CreateQuizRequest,
  UpdateQuizRequest,
  CreateQuestionRequest,
  CreateCourseQuestionRequest,
  QuizAnalytics,
  AnswerDataType,
  SchemeOfWorkEntry,
} from "../types/quiz.types";

// Quiz API Service
export class QuizApiService {
  // Quiz Management
  static async getQuizzes(
    courseId: number,
  ): Promise<{ success: boolean; count: number; data: Quiz[] }> {
    const response = await axios.get(`/courses/${courseId}/quizzes`);
    return response.data;
  }

  static async getQuiz(
    quizId: number,
  ): Promise<{ success: boolean; data: Quiz }> {
    const response = await axios.get(`/quizzes/${quizId}`);
    return response.data;
  }

  static async createQuiz(
    courseId: number,
    quizData: CreateQuizRequest,
  ): Promise<{ success: boolean; data: Quiz }> {
    const response = await axios.post(`/courses/${courseId}/quizzes`, quizData);
    return response.data;
  }

  static async updateQuiz(
    quizId: number,
    quizData: UpdateQuizRequest,
  ): Promise<{ success: boolean; data: Quiz }> {
    const response = await axios.put(`/quizzes/${quizId}`, quizData);
    return response.data;
  }

  static async deleteQuiz(
    quizId: number,
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.delete(`/quizzes/${quizId}`);
    return response.data;
  }

  static async getQuizStats(
    quizId: number,
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.get(`/quizzes/${quizId}/stats`);
    return response.data;
  }

  // Question Management
  static async getQuizQuestions(
    quizId: number,
  ): Promise<{ success: boolean; count: number; data: QuizQuestion[] }> {
    const response = await axios.get(`/quizzes/${quizId}/questions`);
    return response.data;
  }

  static async getQuestion(
    questionId: number,
  ): Promise<{ success: boolean; data: QuizQuestion }> {
    const response = await axios.get(`/quizzes/questions/${questionId}`);
    return response.data;
  }

  static async createQuestion(
    quizId: number,
    questionData: CreateQuestionRequest,
  ): Promise<{ success: boolean; data: QuizQuestion }> {
    const response = await axios.post(
      `/quizzes/${quizId}/questions`,
      questionData,
    );
    return response.data;
  }

  static async updateQuestion(
    questionId: number,
    questionData: Partial<CreateQuestionRequest>,
  ): Promise<{ success: boolean; data: QuizQuestion }> {
    const response = await axios.put(
      `/quizzes/questions/${questionId}`,
      questionData,
    );
    return response.data;
  }

  static async deleteQuestion(
    questionId: number,
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.delete(`/quizzes/questions/${questionId}`);
    return response.data;
  }

  static async reorderQuestions(
    quizId: number,
    questionOrders: Array<{ id: number; order: number }>,
  ): Promise<{ success: boolean; data: QuizQuestion[] }> {
    const response = await axios.put(`/quizzes/${quizId}/questions/reorder`, {
      questionOrders,
    });
    return response.data;
  }

  static async bulkImportQuestions(
    quizId: number,
    questions: CreateQuestionRequest[],
  ): Promise<{ success: boolean; count: number; data: QuizQuestion[] }> {
    const response = await axios.post(`/quizzes/${quizId}/questions/bulk`, {
      questions,
    });
    return response.data;
  }

  // Student Quiz Taking
  static async getAvailableQuizzes(): Promise<{
    success: boolean;
    count: number;
    data: Quiz[];
  }> {
    const response = await axios.get("/quizzes/available");
    return response.data;
  }

  static async getPublicQuizzes(): Promise<{
    success: boolean;
    count: number;
    data: Quiz[];
  }> {
    const response = await axios.get("/quizzes/public");
    return response.data;
  }

  static async startQuizAttempt(quizId: number): Promise<{
    success: boolean;
    data: { submission_id: number; attempt_number: number; quiz_info: any };
  }> {
    const response = await axios.post(`/quizzes/${quizId}/start`);
    return response.data;
  }

  static async getQuizAttemptStatus(
    submissionId: number,
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.get(`/quizzes/attempts/${submissionId}`);
    return response.data;
  }

  static async submitQuestionAnswer(
    submissionId: number,
    questionId: number,
    answerData: AnswerDataType,
    timeTakenSeconds?: number,
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.post(
      `/quizzes/attempts/${submissionId}/questions/${questionId}/answer`,
      {
        answer_data: answerData,
        ...(typeof timeTakenSeconds === "number"
          ? { time_taken: timeTakenSeconds }
          : {}),
      },
    );
    return response.data;
  }

  static async submitAllAnswers(
    submissionId: number,
    answers: Array<{ question_id: number; answer_data: AnswerDataType }>,
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.post(
      `/quizzes/attempts/${submissionId}/submit-all`,
      { answers },
    );
    return response.data;
  }

  static async getAIHint(
    questionId: number,
    data: {
      code: string;
      language: string;
      chatHistory: any[];
      lastError?: string;
    },
  ): Promise<{ success: boolean; data: { hint: string } }> {
    const response = await axios.post(
      `/quizzes/questions/${questionId}/ai-hint`,
      data,
    );
    return response.data;
  }

  static async runCode(
    questionId: number,
    data: {
      code: string;
      language: string;
      stdin?: string;
    },
  ): Promise<{
    success: boolean;
    data: {
      stdout: string | null;
      stderr: string | null;
      status: string;
      exit_code: number;
      execution_time: number;
      memory_used: number | null;
      web_preview: boolean;
    };
  }> {
    const response = await axios.post(
      `/quizzes/questions/${questionId}/run-code`,
      data,
    );
    return response.data;
  }

  static async submitQuiz(
    submissionId: number,
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.post(
      `/quizzes/attempts/${submissionId}/submit`,
    );
    return response.data;
  }

  static async getQuizResults(
    submissionId: number,
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.get(
      `/quizzes/attempts/${submissionId}/results`,
    );
    return response.data;
  }

  static async getStudentQuizHistory(
    studentId: number,
  ): Promise<{ success: boolean; count: number; data: any[] }> {
    const response = await axios.get(`/quizzes/students/${studentId}/history`);
    return response.data;
  }

  static async getMyQuizResults(): Promise<{
    success: boolean;
    count: number;
    data: any[];
  }> {
    const response = await axios.get("/quizzes/my-results");
    return response.data;
  }

  static async generateTestCases(data: {
    problemDescription: string;
    language: string;
    starterCode?: string;
  }): Promise<{ success: boolean; data: any[] }> {
    const response = await axios.post("/quizzes/generate-test-cases", data);
    return response.data;
  }

  /** Instructor prep: run starter code against test cases without creating a submission */
  static async previewRunTests(data: {
    code: string;
    language: string;
    test_cases: Array<{
      id: string;
      input: string;
      expected_output: string;
      is_hidden?: boolean;
      points?: number;
    }>;
  }): Promise<{
    success: boolean;
    data: {
      results: Array<{
        testCaseId: string;
        passed: boolean | null;
        input: string | null;
        expected: string | null;
        actual: string | null;
        error: string | null;
        executionTime: number;
        memoryUsed: number | null;
        status: string;
        is_hidden: boolean;
      }>;
      passed: number;
      total: number;
      web_preview?: boolean;
    };
  }> {
    const response = await axios.post("/quizzes/preview-run", data);
    return response.data;
  }

  // Grading and Analytics
  static async getPendingSubmissions(
    courseId?: number,
  ): Promise<{ success: boolean; count: number; data: any[] }> {
    const params = courseId ? { courseId } : {};
    const response = await axios.get("/quizzes/submissions/pending", {
      params,
    });
    return response.data;
  }

  static async getSubmissionForGrading(
    submissionId: number,
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.get(
      `/quizzes/submissions/${submissionId}/grade`,
    );
    return response.data;
  }

  static async gradeSubmission(
    submissionId: number,
    grades: Record<number, number>,
    feedback?: string,
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.post(
      `/quizzes/submissions/${submissionId}/grade`,
      { grades, feedback },
    );
    return response.data;
  }

  static async updateSubmissionFeedback(
    submissionId: number,
    feedback: string,
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.put(
      `/quizzes/submissions/${submissionId}/feedback`,
      { feedback },
    );
    return response.data;
  }

  static async getQuizAnalytics(
    quizId: number,
  ): Promise<{ success: boolean; data: QuizAnalytics }> {
    const response = await axios.get(`/quizzes/${quizId}/analytics`);
    return response.data;
  }

  static async getQuizSubmissions(
    quizId: number,
    filters?: { status?: string; grade_status?: string; student_id?: number },
  ): Promise<{ success: boolean; count: number; data: any[] }> {
    const response = await axios.get(`/quizzes/${quizId}/submissions`, {
      params: filters,
    });
    return response.data;
  }

  // Bloom's Taxonomy Levels
  static async getBloomsTaxonomyLevels(): Promise<{
    success: boolean;
    count: number;
    data: import("../types/quiz.types").BloomsTaxonomyLevel[];
  }> {
    const response = await axios.get("/quizzes/blooms-levels");
    return response.data;
  }

  static async createBloomsTaxonomyLevel(data: {
    name: string;
    description?: string;
    level_order?: number;
  }): Promise<{
    success: boolean;
    data: import("../types/quiz.types").BloomsTaxonomyLevel;
  }> {
    const response = await axios.post("/quizzes/blooms-levels", data);
    return response.data;
  }

  static async updateBloomsTaxonomyLevel(
    id: number,
    data: { name?: string; description?: string; level_order?: number },
  ): Promise<{
    success: boolean;
    data: import("../types/quiz.types").BloomsTaxonomyLevel;
  }> {
    const response = await axios.put(`/quizzes/blooms-levels/${id}`, data);
    return response.data;
  }

  static async deleteBloomsTaxonomyLevel(
    id: number,
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.delete(`/quizzes/blooms-levels/${id}`);
    return response.data;
  }
}

// Question Bank API Service
export class QuestionBankApiService {
  /**
   * List all questions in a course's question bank.
   * Supports optional filters: question_type, difficulty_level, blooms_taxonomy_level_id, search, page, limit.
   */
  static async getCourseQuestions(
    courseId: number,
    filters?: {
      question_type?: string;
      difficulty_level?: string;
      blooms_taxonomy_level_id?: number;
      search?: string;
      scheme_of_work_entry_id?: string;
      page?: number;
      limit?: number;
    },
  ): Promise<{
    success: boolean;
    count: number;
    page: number;
    total_pages: number;
    data: QuestionBankEntry[];
  }> {
    const response = await axios.get(`/courses/${courseId}/question-bank`, {
      params: filters,
    });
    return response.data;
  }

  /** Get a single question bank entry. */
  static async getQuestionBankQuestion(
    courseId: number,
    id: number,
  ): Promise<{ success: boolean; data: QuestionBankEntry }> {
    const response = await axios.get(
      `/courses/${courseId}/question-bank/${id}`,
    );
    return response.data;
  }

  /** Create a new question in the course bank. */
  static async createCourseQuestion(
    courseId: number,
    data: CreateCourseQuestionRequest,
  ): Promise<{ success: boolean; data: QuestionBankEntry }> {
    const response = await axios.post(
      `/courses/${courseId}/question-bank`,
      data,
    );
    return response.data;
  }

  /** Update a question in the bank. */
  static async updateCourseQuestion(
    courseId: number,
    id: number,
    data: Partial<CreateCourseQuestionRequest>,
  ): Promise<{ success: boolean; data: QuestionBankEntry }> {
    const response = await axios.put(
      `/courses/${courseId}/question-bank/${id}`,
      data,
    );
    return response.data;
  }

  /** Delete a question from the bank (fails if still assigned to any quiz). */
  static async deleteCourseQuestion(
    courseId: number,
    id: number,
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.delete(
      `/courses/${courseId}/question-bank/${id}`,
    );
    return response.data;
  }

  /**
   * Add an existing bank question to a quiz.
   * Wraps QuizApiService.createQuestion with question_id shorthand.
   */
  static async addQuestionToQuiz(
    quizId: number,
    questionId: number,
    assignment: {
      points?: number;
      time_limit_seconds?: number;
      is_required?: boolean;
      order?: number;
    },
  ): Promise<{ success: boolean; data: QuizQuestion }> {
    const response = await axios.post(`/quizzes/${quizId}/questions`, {
      question_id: questionId,
      points: assignment.points ?? 1,
      time_limit_seconds: assignment.time_limit_seconds ?? 60,
      is_required: assignment.is_required ?? true,
      order: assignment.order,
    });
    return response.data;
  }

  /** Get Docx Template */
  static async downloadDocxTemplate(courseId: number): Promise<Blob> {
    const response = await axios.get(
      `/courses/${courseId}/question-bank/template`,
      {
        responseType: "blob",
      },
    );
    return response.data;
  }

  /** Get Excel (XLSX) Template */
  static async downloadXlsxTemplate(courseId: number): Promise<Blob> {
    const response = await axios.get(
      `/courses/${courseId}/question-bank/template/xlsx`,
      { responseType: "blob" },
    );
    return response.data;
  }

  /** Upload and parse XLSX */
  static async parseXlsxQuestions(
    courseId: number,
    file: File,
  ): Promise<{ success: boolean; data: any[] }> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await axios.post(
      `/courses/${courseId}/question-bank/upload/xlsx`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data;
  }

  /** Upload and parse Docx */
  static async parseDocxQuestions(
    courseId: number,
    file: File,
  ): Promise<{ success: boolean; data: any[] }> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await axios.post(
      `/courses/${courseId}/question-bank/upload`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return response.data;
  }

  /** Bulk create questions */
  static async bulkCreateCourseQuestions(
    courseId: number,
    questions: any[],
  ): Promise<{ success: boolean; data: any[] }> {
    const response = await axios.post(
      `/courses/${courseId}/question-bank/bulk`,
      {
        questions,
      },
    );
    return response.data;
  }

  /** Get scheme of work entries for a course/subject */
  static async getSchemeOfWorkEntries(
    courseId: number,
    classGroupId: number,
    academicTermId: number,
  ): Promise<{ success: boolean; data: { scheme: Record<string, unknown>; entries: SchemeOfWorkEntry[] } | SchemeOfWorkEntry[] }> {
    const response = await axios.get(
      `/courses/${courseId}/question-bank/scheme-of-work`,
      {
        params: {
          class_group_id: classGroupId,
          academic_term_id: academicTermId,
        },
      },
    );
    return response.data;
  }

  /**
   * Upload a PDF or DOCX document and use AI to generate questions from it.
   * Returns a preview — questions are NOT saved. Call bulkCreateCourseQuestions() after confirmation.
   */
  static async generateQuestionsFromDocument(
    courseId: number,
    file: File,
    options: {
      questionTypes: string[];
      countPerType: number;
      difficulty: "EASY" | "MEDIUM" | "DIFFICULT";
      additionalContext?: string;
    },
  ): Promise<{
    success: boolean;
    count: number;
    skipped: number;
    document_info: { char_count: number; truncated: boolean };
    data: any[];
  }> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("question_types", JSON.stringify(options.questionTypes));
    formData.append("count_per_type", String(options.countPerType));
    formData.append("difficulty", options.difficulty);
    if (options.additionalContext) {
      formData.append("additional_context", options.additionalContext);
    }

    const response = await axios.post(
      `/courses/${courseId}/question-bank/ai-generate`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      },
    );
    return response.data;
  }
}

// Error handling utility
export class QuizApiError extends Error {
  public statusCode: number;
  public errors?: any[];

  constructor(message: string, statusCode: number, errors?: any[]) {
    super(message);
    this.name = "QuizApiError";
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

// API response wrapper with error handling
export async function handleQuizApiCall<T>(
  apiCall: () => Promise<{
    success: boolean;
    data: T;
    message?: string;
    errors?: any[];
  }>,
): Promise<T> {
  try {
    const response = await apiCall();

    if (!response.success) {
      throw new QuizApiError(
        response.message || "API call failed",
        400,
        response.errors,
      );
    }

    return response.data;
  } catch (error: any) {
    if (error.response) {
      // Server responded with error status
      throw new QuizApiError(
        error.response.data.message || "Server error",
        error.response.status,
        error.response.data.errors,
      );
    } else if (error.request) {
      // Network error
      throw new QuizApiError("Network error - please check your connection", 0);
    } else {
      // Other error
      throw new QuizApiError(error.message || "Unknown error occurred", 0);
    }
  }
}
