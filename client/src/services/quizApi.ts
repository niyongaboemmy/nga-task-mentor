import axios from "../utils/axiosConfig";
import type {
  Quiz,
  QuizQuestion,
  CreateQuizRequest,
  UpdateQuizRequest,
  CreateQuestionRequest,
  QuizAnalytics,
  AnswerDataType,
  QuestionDataType,
} from "../types/quiz.types";

// Helper function to parse question data from API response
function parseQuestionData(question: any): QuizQuestion {
  if (typeof question.question_data === "string") {
    try {
      const parsed = JSON.parse(question.question_data);
      // Remove correct_answer from question_data if present, as it's stored separately
      if ("correct_answer" in parsed) {
        delete parsed.correct_answer;
      }
      question.question_data = parsed as QuestionDataType;
    } catch (error) {
      console.error("Failed to parse question_data:", error);
      question.question_data = {};
    }
  }
  if (typeof question.correct_answer === "string") {
    try {
      question.correct_answer = JSON.parse(question.correct_answer);
    } catch (error) {
      // If parsing fails, keep as string or set to null
      question.correct_answer = null;
    }
  }
  return question as QuizQuestion;
}

// Quiz API Service
export class QuizApiService {
  // Quiz Management
  static async getQuizzes(
    courseId: number
  ): Promise<{ success: boolean; count: number; data: Quiz[] }> {
    const response = await axios.get(`/api/courses/${courseId}/quizzes`);
    return response.data;
  }

  static async getQuiz(
    quizId: number
  ): Promise<{ success: boolean; data: Quiz }> {
    const response = await axios.get(`/api/quizzes/${quizId}`);
    if (
      response.data.success &&
      response.data.data &&
      response.data.data.questions
    ) {
      response.data.data.questions =
        response.data.data.questions.map(parseQuestionData);
    }
    return response.data;
  }

  static async createQuiz(
    quizData: CreateQuizRequest
  ): Promise<{ success: boolean; data: Quiz }> {
    const response = await axios.post(`/api/quizzes`, quizData);
    return response.data;
  }

  static async updateQuiz(
    quizId: number,
    quizData: UpdateQuizRequest
  ): Promise<{ success: boolean; data: Quiz }> {
    const response = await axios.put(`/api/quizzes/${quizId}`, quizData);
    return response.data;
  }

  static async deleteQuiz(
    quizId: number
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.delete(`/api/quizzes/${quizId}`);
    return response.data;
  }

  static async getQuizStats(
    quizId: number
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.get(`/api/quizzes/${quizId}/stats`);
    return response.data;
  }

  // Question Management
  static async getQuizQuestions(
    quizId: number
  ): Promise<{ success: boolean; count: number; data: QuizQuestion[] }> {
    const response = await axios.get(`/api/quizzes/${quizId}/questions`);
    if (response.data.success && response.data.data) {
      response.data.data = response.data.data.map(parseQuestionData);
    }
    return response.data;
  }

  static async getQuestion(
    questionId: number
  ): Promise<{ success: boolean; data: QuizQuestion }> {
    const response = await axios.get(`/api/quizzes/questions/${questionId}`);
    if (response.data.success && response.data.data) {
      response.data.data = parseQuestionData(response.data.data);
    }
    return response.data;
  }

  static async createQuestion(
    quizId: number,
    questionData: CreateQuestionRequest
  ): Promise<{ success: boolean; data: QuizQuestion }> {
    const response = await axios.post(
      `/api/quizzes/${quizId}/questions`,
      questionData
    );
    // API returns QuizQuestion directly, so wrap it in the expected format
    return { success: true, data: parseQuestionData(response.data) };
  }

  static async updateQuestion(
    questionId: number,
    questionData: Partial<CreateQuestionRequest>
  ): Promise<{ success: boolean; data: QuizQuestion }> {
    const response = await axios.put(
      `/api/quizzes/questions/${questionId}`,
      questionData
    );
    // API returns QuizQuestion directly, so wrap it in the expected format
    return { success: true, data: parseQuestionData(response.data) };
  }

  static async deleteQuestion(
    questionId: number
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.delete(`/api/quizzes/questions/${questionId}`);
    return response.data;
  }

  static async reorderQuestions(
    quizId: number,
    questionOrders: Array<{ id: number; order: number }>
  ): Promise<{ success: boolean; data: QuizQuestion[] }> {
    const response = await axios.put(
      `/api/quizzes/${quizId}/questions/reorder`,
      { questionOrders }
    );
    if (response.data.success && response.data.data) {
      response.data.data = response.data.data.map(parseQuestionData);
    }
    return response.data;
  }

  static async bulkImportQuestions(
    quizId: number,
    questions: CreateQuestionRequest[]
  ): Promise<{ success: boolean; count: number; data: QuizQuestion[] }> {
    const response = await axios.post(`/api/quizzes/${quizId}/questions/bulk`, {
      questions,
    });
    if (response.data.success && response.data.data) {
      response.data.data = response.data.data.map(parseQuestionData);
    }
    return response.data;
  }

  // Student Quiz Taking
  static async getAvailableQuizzes(): Promise<{
    success: boolean;
    count: number;
    data: Quiz[];
  }> {
    const response = await axios.get("/api/quizzes/available");
    return response.data;
  }

  static async getPublicQuizzes(): Promise<{
    success: boolean;
    count: number;
    data: Quiz[];
  }> {
    const response = await axios.get("/api/quizzes/public");
    return response.data;
  }

  static async startQuizAttempt(quizId: number): Promise<{
    success: boolean;
    data: { submission_id: number; attempt_number: number; quiz_info: any };
  }> {
    const response = await axios.post(`/api/quizzes/${quizId}/start`);
    return response.data;
  }

  static async getQuizAttemptStatus(
    submissionId: number
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.get(`/api/quizzes/attempts/${submissionId}`);
    return response.data;
  }

  static async submitQuestionAnswer(
    submissionId: number,
    questionId: number,
    answerData: AnswerDataType
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.post(
      `/api/quizzes/attempts/${submissionId}/questions/${questionId}/answer`,
      { answer_data: answerData }
    );
    return response.data;
  }

  static async submitAllAnswers(
    submissionId: number,
    answers: Array<{ question_id: number; answer_data: AnswerDataType }>
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.post(
      `/api/quizzes/attempts/${submissionId}/submit-all`,
      { answers }
    );
    return response.data;
  }

  static async submitQuiz(
    submissionId: number
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.post(
      `/api/quizzes/attempts/${submissionId}/submit`
    );
    return response.data;
  }

  static async getQuizResults(
    submissionId: number
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.get(
      `/api/quizzes/attempts/${submissionId}/results`
    );
    return response.data;
  }

  static async getStudentQuizHistory(
    studentId: number
  ): Promise<{ success: boolean; count: number; data: any[] }> {
    const response = await axios.get(
      `/api/quizzes/students/${studentId}/history`
    );
    return response.data;
  }

  static async getMyQuizResults(): Promise<{
    success: boolean;
    count: number;
    data: any[];
  }> {
    const response = await axios.get("/api/quizzes/my-results");
    return response.data;
  }

  // Grading and Analytics
  static async getPendingSubmissions(
    courseId?: number
  ): Promise<{ success: boolean; count: number; data: any[] }> {
    const params = courseId ? { courseId } : {};
    const response = await axios.get("/api/quizzes/submissions/pending", {
      params,
    });
    return response.data;
  }

  static async getSubmissionForGrading(
    submissionId: number
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.get(
      `/api/quizzes/submissions/${submissionId}/grade`
    );
    return response.data;
  }

  static async gradeSubmission(
    submissionId: number,
    grades: Record<number, number>,
    feedback?: string
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.post(
      `/api/quizzes/submissions/${submissionId}/grade`,
      { grades, feedback }
    );
    return response.data;
  }

  static async updateSubmissionFeedback(
    submissionId: number,
    feedback: string
  ): Promise<{ success: boolean; data: any }> {
    const response = await axios.put(
      `/api/quizzes/submissions/${submissionId}/feedback`,
      { feedback }
    );
    return response.data;
  }

  static async getQuizAnalytics(
    quizId: number
  ): Promise<{ success: boolean; data: QuizAnalytics }> {
    const response = await axios.get(`/api/quizzes/${quizId}/analytics`);
    return response.data;
  }

  static async getQuizSubmissions(
    quizId: number,
    filters?: { status?: string; grade_status?: string; student_id?: number }
  ): Promise<{ success: boolean; count: number; data: any[] }> {
    const response = await axios.get(`/api/quizzes/${quizId}/submissions`, {
      params: filters,
    });
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
  }>
): Promise<T> {
  try {
    const response = await apiCall();

    if (!response.success) {
      throw new QuizApiError(
        response.message || "API call failed",
        400,
        response.errors
      );
    }

    return response.data;
  } catch (error: any) {
    if (error.response) {
      // Server responded with error status
      throw new QuizApiError(
        error.response.data.message || "Server error",
        error.response.status,
        error.response.data.errors
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
