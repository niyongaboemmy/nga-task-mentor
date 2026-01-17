// Question type definitions for the quiz system

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

// Base interface for all question data
export interface BaseQuestionData {
  explanation?: string;
  hint?: string;
}

// Single Choice Question
export interface SingleChoiceData extends BaseQuestionData {
  options: string[];
  correct_option_index: number;
}

export interface SingleChoiceAnswer {
  selected_option_index: number;
}

// Multiple Choice Question
export interface MultipleChoiceData extends BaseQuestionData {
  options: string[];
  correct_option_indices: number[];
  min_selections?: number;
  max_selections?: number;
}

export interface MultipleChoiceAnswer {
  selected_option_indices: number[];
}

// True or False Question
export interface TrueFalseData extends BaseQuestionData {
  correct_answer: boolean;
}

export interface TrueFalseAnswer {
  selected_answer: boolean;
}

// Matching Question
export interface MatchingData extends BaseQuestionData {
  left_items: Array<{ id: string; text: string; image?: string }>;
  right_items: Array<{ id: string; text: string; image?: string }>;
  correct_matches: Record<string, string>; // left_id -> right_id
}

export interface MatchingAnswer {
  matches: Record<string, string>; // left_id -> right_id
}

// Fill in the Blank Question
export interface FillBlankData extends BaseQuestionData {
  text_with_blanks: string; // Text with {{blank}} placeholders
  acceptable_answers: Array<{
    blank_index: number;
    answers: string[];
    case_sensitive?: boolean;
  }>;
}

export interface FillBlankAnswer {
  answers: Array<{ blank_index: number; answer: string }>;
}

// Dropdown Selection Question
export interface DropdownData extends BaseQuestionData {
  text_with_dropdowns: string; // Text with {{dropdown}} placeholders
  dropdown_options: Array<{
    dropdown_index: number;
    options: string[];
  }>;
}

export interface DropdownAnswer {
  selections: Array<{ dropdown_index: number; selected_option: string }>;
}

// Numerical Question
export interface NumericalData extends BaseQuestionData {
  correct_answer: number;
  tolerance?: number; // allowed margin of error
  precision?: number; // decimal places to check
  units?: string; // expected units
  acceptable_range?: {
    min: number;
    max: number;
  };
}

export interface NumericalAnswer {
  answer: number;
  units?: string;
}

// Algorithmic Question
export interface AlgorithmicData extends BaseQuestionData {
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

export interface AlgorithmicAnswer {
  solution: string;
  language: string;
}

// Short Answer Question
export interface ShortAnswerData extends BaseQuestionData {
  max_length?: number;
  keywords?: string[]; // for grading assistance
  sample_answer?: string;
}

export interface ShortAnswerAnswer {
  answer: string;
}

// Coding Question
export interface CodingData extends BaseQuestionData {
  language: string;
  starter_code?: string;
  test_cases: Array<{
    id: string;
    input: string;
    expected_output: string;
    is_hidden: boolean;
    points: number;
    explanation?: string;
    time_limit?: number; // seconds
    memory_limit?: number; // MB
  }>;
  constraints?: string;
  allowed_languages?: string[];
}

export interface CodingAnswer {
  code: string;
  language: string;
}

// Logical or Boolean Expression Question
export interface LogicalExpressionData extends BaseQuestionData {
  expression_format: string; // e.g., "A AND B OR C"
  variables: Array<{
    name: string;
    description: string;
    type?: "boolean" | "number" | "string";
  }>;
  truth_table?: Array<{
    inputs: Record<string, any>;
    output: boolean;
  }>;
  correct_expression: string; // the correct boolean expression
}

export interface LogicalExpressionAnswer {
  expression: string;
}

// Drag and Drop Question
export interface DragDropData extends BaseQuestionData {
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

export interface DragDropAnswer {
  placements: Record<string, string>; // drop_zone_id -> draggable_item_id
}

// Ordering or Sequencing Question
export interface OrderingData extends BaseQuestionData {
  items: Array<{
    id: string;
    text: string;
    image?: string;
    order: number; // correct order position
  }>;
  allow_partial_credit?: boolean;
}

export interface OrderingAnswer {
  ordered_item_ids: string[];
}

// Union type for all question data types
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

// Union type for all answer types
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

// Quiz related types
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

// Question validation interfaces
export interface QuestionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// Quiz creation interfaces
export interface CreateQuizRequest {
  title: string;
  description: string;
  course_id: number;
  status?: QuizStatus;
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

// Question creation interfaces
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

// Quiz attempt interfaces
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
  total_attempts: number;
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
  last_attempt?: Date;
}
