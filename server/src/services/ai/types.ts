export interface AIGradingResult {
  is_correct: boolean;
  points_earned: number;
  feedback: string;
}

export interface AICodingGradingResult extends AIGradingResult {
  quality_score: number;
  efficiency_score: number;
  correctness_score: number;
}

export interface AIQuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface AIFeedback {
  summary: string;
  strengths: string[];
  improvements: string[];
  encouragement: string;
}

export interface AISummary {
  summary: string;
  keyPoints: string[];
  vocabulary: string[];
}

export interface AITestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  points: number;
  explanation: string;
}

export interface AIGenerateFromDocumentParams {
  documentText: string;
  questionTypes: string[];
  countPerType: number;
  difficulty: "EASY" | "MEDIUM" | "DIFFICULT";
  additionalContext?: string;
}

export interface AIGeneratedQuestion {
  question_type: string;
  question_text: string;
  question_data: Record<string, any>;
  correct_answer?: any;
  explanation?: string;
  difficulty_level: string;
  tags?: string[];
  time_limit_seconds?: number;
}

export interface AISqlQueryContext {
  tableNames: string[];
  tableColumns?: string[];
}

export interface AISqlQueryResult {
  sql: string;
  explanation?: string;
}
