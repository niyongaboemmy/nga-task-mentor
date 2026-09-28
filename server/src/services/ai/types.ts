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

export type AIDifficulty = "EASY" | "MEDIUM" | "DIFFICULT";

/** How many questions of one type to generate at each difficulty. */
export interface AIGenerationPlanItem {
  question_type: string;
  EASY: number;
  MEDIUM: number;
  DIFFICULT: number;
}

export interface AIGenerateFromSourceParams {
  sourceText: string;
  /** Short human description of where the text came from, e.g. "Week 3 lesson plan". */
  sourceLabel?: string;
  plan: AIGenerationPlanItem[];
  additionalContext?: string;
  /** Question texts to steer away from (earlier batches, existing bank questions). */
  avoidQuestions?: string[];
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
  /** 1-6 as the AI reported it (before alignment); see bloomsAlignment.ts. */
  blooms_level?: number | null;
  blooms_taxonomy_level_id?: number | null;
  blooms_level_name?: string | null;
  /** True when the AI's level didn't fit the difficulty and was moved into its band. */
  blooms_adjusted?: boolean;
}

export interface AISqlQueryContext {
  tableNames: string[];
  tableColumns?: string[];
}

export interface AISqlQueryResult {
  sql: string;
  explanation?: string;
}
