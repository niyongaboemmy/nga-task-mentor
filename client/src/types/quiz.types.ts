// Frontend quiz types - matching the backend types but adapted for React

export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "matching"
  | "fill_blank"
  | "dropdown"
  | "numerical"
  | "algorithmic"
  | "short_answer"
  | "coding"
  | "logical_expression"
  | "drag_drop"
  | "ordering";

export type QuizStatus = "draft" | "published" | "completed";
export type QuizType = "practice" | "graded" | "exam";
export type AttemptStatus =
  | "in_progress"
  | "completed"
  | "timed_out"
  | "abandoned";
export type SubmissionStatus =
  | "in_progress"
  | "completed"
  | "timed_out"
  | "abandoned";
export type GradeStatus = "pending" | "graded" | "auto_graded";

// Question data interfaces
export interface SingleChoiceData {
  options: string[];
  correct_option_index: number;
}

export interface MultipleChoiceData {
  options: string[];
  correct_option_indices: number[];
  min_selections?: number;
  max_selections?: number;
}

export interface TrueFalseData {
  correct_answer: boolean;
}

export interface MatchingData {
  left_items: Array<{ id: string; text: string; image?: string }>;
  right_items: Array<{ id: string; text: string; image?: string }>;
  correct_matches: Record<string, string>;
}

export interface FillBlankData {
  text_with_blanks: string;
  acceptable_answers: Array<{
    blank_index: number;
    answers: string[];
    case_sensitive?: boolean;
  }>;
}

export interface DropdownData {
  text_with_dropdowns: string;
  dropdown_options: Array<{
    dropdown_index: number;
    options: string[];
  }>;
}

export interface NumericalData {
  correct_answer: number;
  tolerance?: number;
  precision?: number;
  units?: string;
  acceptable_range?: {
    min: number;
    max: number;
  };
}

export interface AlgorithmicData {
  algorithm_description: string;
  input_format: string;
  output_format: string;
  constraints?: string;
  test_cases: Array<{
    id: string;
    input: string;
    expected_output: string;
    is_hidden: boolean;
    points: number;
    explanation?: string;
  }>;
}

export interface ShortAnswerData {
  max_length?: number;
  keywords?: string[];
  sample_answer?: string;
}

export interface CodingData {
  language: string;
  starter_code?: string;
  test_cases: Array<{
    id: string;
    input: string;
    expected_output: string;
    is_hidden: boolean;
    points: number;
    explanation?: string;
    time_limit?: number;
    memory_limit?: number;
  }>;
  constraints?: string;
  allowed_languages?: string[];
}

export interface LogicalExpressionData {
  expression_format: string;
  variables: Array<{
    name: string;
    description: string;
    type?: "boolean" | "number" | "string";
  }>;
  truth_table?: Array<{
    inputs: Record<string, any>;
    output: boolean;
  }>;
  correct_expression: string;
}

export interface DragDropData {
  background_image?: string;
  drop_zones: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    correct_items: string[];
    label?: string;
  }>;
  draggable_items: Array<{
    id: string;
    text: string;
    image?: string;
    value: string;
  }>;
}

export interface OrderingData {
  items: Array<{
    id: string;
    text: string;
    image?: string;
    order: number;
  }>;
  allow_partial_credit?: boolean;
}

export type QuestionDataType =
  | SingleChoiceData
  | MultipleChoiceData
  | TrueFalseData
  | MatchingData
  | FillBlankData
  | DropdownData
  | NumericalData
  | AlgorithmicData
  | ShortAnswerData
  | CodingData
  | LogicalExpressionData
  | DragDropData
  | OrderingData;

// Answer interfaces
export interface SingleChoiceAnswer {
  selected_option_index: number;
}

export interface MultipleChoiceAnswer {
  selected_option_indices: number[];
}

export interface TrueFalseAnswer {
  selected_answer: boolean;
}

export interface MatchingAnswer {
  matches: Record<string, string>;
}

export interface FillBlankAnswer {
  answers: Array<{ blank_index: number; answer: string }>;
}

export interface DropdownAnswer {
  selections: Array<{ dropdown_index: number; selected_option: string }>;
}

export interface NumericalAnswer {
  answer: number;
  units?: string;
}

export interface AlgorithmicAnswer {
  solution: string;
  language: string;
}

export interface ShortAnswerAnswer {
  answer: string;
}

export interface CodingAnswer {
  code: string;
  language: string;
}

export interface LogicalExpressionAnswer {
  expression: string;
  variables?: Array<{ name: string; value: boolean }>;
}

export interface DragDropAnswer {
  placements: Record<string, string>;
}

export interface OrderingAnswer {
  ordered_item_ids: string[];
}

export type AnswerDataType =
  | SingleChoiceAnswer
  | MultipleChoiceAnswer
  | TrueFalseAnswer
  | MatchingAnswer
  | FillBlankAnswer
  | DropdownAnswer
  | NumericalAnswer
  | AlgorithmicAnswer
  | ShortAnswerAnswer
  | CodingAnswer
  | LogicalExpressionAnswer
  | DragDropAnswer
  | OrderingAnswer;

// Quiz interfaces
export interface Quiz {
  id: number;
  title: string;
  description: string;
  instructions?: string;
  status: QuizStatus;
  type: QuizType;
  time_limit?: number;
  max_attempts?: number;
  passing_score?: number;
  show_results_immediately: boolean;
  randomize_questions: boolean;
  show_correct_answers: boolean;
  start_date?: string;
  end_date?: string;
  course_id: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  course?: {
    id: number;
    title: string;
    code: string;
  };
  creator?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  questions?: QuizQuestion[];
  total_questions?: number;
  total_points?: number;
  is_available?: boolean;
  is_active?: boolean;
  is_public?: boolean;
}

export interface QuizQuestion {
  id: number;
  quiz_id: number;
  question_type: QuestionType;
  question_text: string;
  question_data: QuestionDataType;
  correct_answer?: object;
  explanation?: string;
  points: number;
  order: number;
  time_limit_seconds: number;
  is_required: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
  quiz?: Quiz;
  attempts?: QuizAttempt[];
  time_limit?: string;
}

export interface QuizAttempt {
  id: number;
  quiz_id: number;
  question_id: number;
  student_id: number;
  submission_id?: number;
  submitted_answer?: object;
  correct_answer?: object;
  is_correct?: boolean;
  points_earned?: number;
  time_taken?: number;
  status: AttemptStatus;
  started_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  question?: QuizQuestion;
  quiz?: Quiz;
  student?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface QuizSubmission {
  id: number;
  quiz_id: number;
  student_id: number;
  total_score: number;
  max_score: number;
  percentage: number;
  status: SubmissionStatus;
  grade_status: GradeStatus;
  time_taken: number;
  started_at: string;
  completed_at?: string;
  graded_at?: string;
  graded_by?: number;
  feedback?: string;
  passed: boolean;
  attempt_number: number;
  created_at: string;
  updated_at: string;
  quiz?: Quiz;
  student?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  grader?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  attempts?: QuizAttempt[];
}

// API Request/Response interfaces
export interface CreateQuizRequest {
  title: string;
  description: string;
  course_id: number;
  instructions?: string;
  type: QuizType;
  time_limit?: number;
  max_attempts?: number;
  passing_score?: number;
  show_results_immediately: boolean;
  randomize_questions: boolean;
  show_correct_answers: boolean;
  enable_automatic_grading?: boolean;
  require_manual_grading?: boolean;
  start_date?: string;
  end_date?: string;
  is_public?: boolean;
}

export interface UpdateQuizRequest extends Partial<CreateQuizRequest> {
  status?: QuizStatus;
}

export interface CreateQuestionRequest {
  question_type: QuestionType;
  question_text: string;
  question_data: QuestionDataType;
  correct_answer?: object;
  explanation?: string;
  points: number;
  order: number;
  time_limit_seconds: number;
  is_required: boolean;
}

export interface StartQuizAttemptRequest {
  quiz_id: number;
}

export interface SubmitQuestionAnswerRequest {
  question_id: number;
  answer_data: AnswerDataType;
}

export interface SubmitQuizRequest {
  submission_id: number;
}

// Grading interfaces
export interface GradingResult {
  is_correct: boolean;
  points_earned: number;
  feedback?: string;
  detailed_feedback?: Record<string, any>;
}

// Analytics interfaces
export interface QuizAnalytics {
  total_submissions: number;
  average_score: number;
  average_time: number;
  pass_rate: number;
  question_difficulty: Array<{
    question_id: number;
    difficulty_score: number;
    correct_rate: number;
  }>;
}

export interface StudentPerformance {
  student_id: number;
  student_name: string;
  attempts: number;
  best_score: number;
  average_score: number;
  total_time: number;
  last_attempt?: string;
}

// Component prop interfaces
export interface QuestionComponentProps {
  question: QuizQuestion;
  answer?: AnswerDataType;
  onAnswerChange: (answer: AnswerDataType) => void;
  disabled?: boolean;
  showCorrectAnswer?: boolean;
  timeRemaining?: number;
}

export interface QuizAttemptProps {
  submissionId: number;
  quiz: Quiz;
  onComplete: (results: any) => void;
  onTimeUp?: () => void;
}
