export type GradingStrategy =
  | "all_or_nothing" // 0 or full points
  | "partial_credit" // Proportional to correct answers
  | "penalty_based" // Deduct points for wrong answers
  | "weighted_partial"; // Custom weights for different aspects

export interface BaseGradingConfig {
  strategy: GradingStrategy;
  enable_partial_credit: boolean;
  minimum_score_percentage: number; // 0-100, minimum score even if all wrong
  maximum_penalty_percentage: number; // 0-100, maximum deduction for wrong answers
}

export interface MultipleChoiceGradingConfig extends BaseGradingConfig {
  penalty_per_wrong_selection: number; // Points to deduct per wrong choice
  allow_negative_score: boolean; // Whether score can go below 0
}

export interface ShortAnswerGradingConfig extends BaseGradingConfig {
  keyword_matching_mode: "exact" | "partial" | "fuzzy";
  minimum_keywords_required: number;
  case_sensitive: boolean;
  allow_synonyms: boolean;
}

export interface CodingGradingConfig extends BaseGradingConfig {
  compilation_penalty: number; // Points deducted for compilation errors
  test_case_weights: "equal" | "custom";
  custom_weights?: Record<string, number>; // test_case_id -> weight
  runtime_penalty: number; // Points deducted for timeouts
  memory_penalty: number; // Points deducted for memory issues
}

export interface NumericalGradingConfig extends BaseGradingConfig {
  tolerance_mode: "absolute" | "percentage" | "range";
  absolute_tolerance?: number;
  percentage_tolerance?: number;
  acceptable_range?: { min: number; max: number };
  units_required: boolean;
  units_penalty: number; // Points deducted for wrong/missing units
}

export interface MatchingGradingConfig extends BaseGradingConfig {
  allow_partial_matches: boolean;
  bonus_for_perfect_order: number; // Extra points for correct ordering
}

export interface OrderingGradingConfig extends BaseGradingConfig {
  position_weight_mode: "equal" | "weighted"; // Later positions more important
  adjacency_bonus: number; // Bonus for items in correct relative order
}

export interface FillBlankGradingConfig extends BaseGradingConfig {
  blank_independence: boolean; // Whether blanks are scored independently
  partial_blank_credit: boolean; // Give credit for partially correct blanks
}

export interface TrueFalseGradingConfig extends BaseGradingConfig {
  explanation_required: boolean; // Require explanation for points
  explanation_bonus: number; // Extra points for correct explanation
}

export type QuestionGradingConfig =
  | { type: "single_choice" | "true_false"; config: TrueFalseGradingConfig }
  | { type: "multiple_choice"; config: MultipleChoiceGradingConfig }
  | { type: "short_answer"; config: ShortAnswerGradingConfig }
  | { type: "numerical"; config: NumericalGradingConfig }
  | { type: "fill_blank"; config: FillBlankGradingConfig }
  | { type: "matching"; config: MatchingGradingConfig }
  | { type: "ordering"; config: OrderingGradingConfig }
  | { type: "dropdown"; config: BaseGradingConfig }
  | { type: "coding"; config: CodingGradingConfig };

export interface QuizGradingConfig {
  question_configs: Record<string, QuestionGradingConfig>; // question_type -> config
  overall_passing_score: number; // 0-100
  grade_boundaries: {
    A: number;
    B: number;
    C: number;
    D: number;
  };
  enable_late_penalty: boolean;
  late_penalty_percentage: number; // Percentage deducted per day late
  max_late_penalty_percentage: number; // Maximum late penalty
}

export interface GradingResult {
  is_correct: boolean;
  points_earned: number;
  max_points: number;
  percentage: number;
  feedback: string;
  detailed_feedback?: {
    strategy_used: GradingStrategy;
    breakdown?: Record<string, number>; // aspect -> points earned
    penalties_applied?: Record<string, number>; // penalty_type -> points deducted
    bonuses_earned?: Record<string, number>; // bonus_type -> points added
  };
}

export interface NormalizedAnswer {
  type: string;
  data: any;
  metadata?: {
    time_taken?: number;
    attempts?: number;
    hints_used?: number;
  };
}

export interface NormalizedCorrectAnswer {
  type: string;
  data: any;
  explanation?: string;
  alternative_answers?: any[];
}
