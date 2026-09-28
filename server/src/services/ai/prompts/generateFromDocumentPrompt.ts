import {
  AIGenerateFromDocumentParams,
  AIGenerationPlanItem,
  AIGenerateFromSourceParams,
} from "../types";
import { bloomPromptSection } from "../bloomsAlignment";

const TYPE_SCHEMAS: Record<string, string> = {
  single_choice: `TYPE: single_choice
question_data: { "options": ["Option A", "Option B", "Option C", "Option D"], "correct_option_index": 0 }
correct_answer: { "selected_option_index": 0 }
RULES: options must have 2-6 strings. correct_option_index is 0-based.`,

  multiple_choice: `TYPE: multiple_choice
question_data: { "options": ["Option A", "Option B", "Option C", "Option D"], "correct_option_indices": [0, 2] }
correct_answer: { "selected_option_indices": [0, 2] }
RULES: At least 2 correct indices. correct_option_indices must be valid 0-based indices.`,

  true_false: `TYPE: true_false
question_data: { "correct_answer": true }
correct_answer: { "selected_answer": true }
RULES: Both values must be boolean (true or false).`,

  fill_blank: `TYPE: fill_blank
question_data: { "text_with_blanks": "The {{blank}} is the basic unit of life.", "acceptable_answers": [{ "blank_index": 0, "answers": ["cell", "Cell"], "case_sensitive": false }] }
correct_answer: { "answers": [{ "blank_index": 0, "answer": "cell" }] }
RULES: Use {{blank}} as placeholder. blank_index is 0-based.`,

  matching: `TYPE: matching
question_data: { "left_items": [{"id": "l1", "text": "Mitochondria"}, {"id": "l2", "text": "Nucleus"}], "right_items": [{"id": "r1", "text": "Energy production"}, {"id": "r2", "text": "Cell control"}], "correct_matches": {"l1": "r1", "l2": "r2"} }
correct_answer: { "matches": {"l1": "r1", "l2": "r2"} }
RULES: 2-8 items each side. IDs must be unique strings matching format l1/r1.`,

  dropdown: `TYPE: dropdown
question_data: { "text_with_dropdowns": "Water boils at {{dropdown}} degrees Celsius.", "dropdown_options": [{ "dropdown_index": 0, "options": ["50", "100", "150", "200"] }] }
correct_answer: { "selections": [{ "dropdown_index": 0, "selected_option": "100" }] }
RULES: Use {{dropdown}} as placeholder. selected_option must be one of the options.`,

  numerical: `TYPE: numerical
question_data: { "correct_answer": 9.8, "tolerance": 0.1, "units": "m/s²", "precision": 1 }
correct_answer: { "answer": 9.8, "units": "m/s²" }
RULES: correct_answer is a number. tolerance is the acceptable margin.`,

  short_answer: `TYPE: short_answer
question_data: { "max_length": 500, "keywords": ["photosynthesis", "chlorophyll", "light"], "sample_answer": "Photosynthesis is the process by which plants convert light into energy." }
correct_answer: null
RULES: keywords must be 3-8 key terms. sample_answer is a model response.`,

  ordering: `TYPE: ordering
question_data: { "items": [{"id": "i1", "text": "First step", "order": 1}, {"id": "i2", "text": "Second step", "order": 2}, {"id": "i3", "text": "Third step", "order": 3}] }
correct_answer: { "ordered_item_ids": ["i1", "i2", "i3"] }
RULES: 2-8 items. order is the correct 1-based position.`,

  drag_drop: `TYPE: drag_drop
question_data: { "drop_zones": [{"id": "z1", "x": 0, "y": 0, "width": 200, "height": 80, "correct_items": ["d1"], "label": "Zone label"}], "draggable_items": [{"id": "d1", "text": "Draggable item", "value": "item_value"}] }
correct_answer: { "placements": {"z1": "d1"} }
RULES: At least 2 drop zones and 2 draggable items. x, y, width, height are numbers.`,

  algorithmic: `TYPE: algorithmic
question_data: { "algorithm_description": "Sort an array in ascending order", "input_format": "Array of integers", "output_format": "Sorted array", "constraints": "Length <= 100", "test_cases": [{"id": "tc1", "input": "[3,1,2]", "expected_output": "[1,2,3]", "is_hidden": false, "points": 100}] }
correct_answer: null
RULES: Provide 2-4 test cases. points must sum to 100.`,

  coding: `TYPE: coding
question_data: { "language": "python", "starter_code": "def solution(n):\\n    pass", "test_cases": [{"id": "tc1", "input": "5", "expected_output": "25", "is_hidden": false, "points": 100}], "constraints": "Time limit: 1s" }
correct_answer: null
RULES: language must be one of: python, javascript, java, c, cpp. Test case points must sum to 100.`,

  logical_expression: `TYPE: logical_expression
question_data: { "expression_format": "A AND B OR NOT C", "variables": [{"name": "A", "description": "Switch is on", "type": "boolean"}, {"name": "B", "description": "Door is closed", "type": "boolean"}, {"name": "C", "description": "Power is off", "type": "boolean"}], "correct_expression": "A AND B OR NOT C" }
correct_answer: { "expression": "A AND B OR NOT C" }
RULES: variables must use boolean type. Operators: AND, OR, NOT, XOR.`,
};

export const SUPPORTED_AI_QUESTION_TYPES = Object.keys(TYPE_SCHEMAS);

const DIFFICULTY_GUIDE = `DIFFICULTY GUIDE:
- EASY: recall and recognition of facts stated directly in the source (Bloom's remember/understand).
- MEDIUM: apply or explain an idea from the source in a new but familiar situation (apply/analyse).
- DIFFICULT: multi-step reasoning, comparing/evaluating ideas, or transferring them to an unfamiliar scenario (analyse/evaluate/create).`;

export function planTotal(plan: AIGenerationPlanItem[]): number {
  return plan.reduce((n, p) => n + p.EASY + p.MEDIUM + p.DIFFICULT, 0);
}

/** "single_choice: 2 EASY, 1 MEDIUM" — one line per type, zero counts omitted. */
function describePlan(plan: AIGenerationPlanItem[]): string {
  return plan
    .map((p) => {
      const parts = (["EASY", "MEDIUM", "DIFFICULT"] as const)
        .filter((d) => p[d] > 0)
        .map((d) => `${p[d]} ${d}`);
      return parts.length ? `- ${p.question_type}: ${parts.join(", ")}` : null;
    })
    .filter(Boolean)
    .join("\n");
}

export function buildGenerateFromSourcePrompt(params: AIGenerateFromSourceParams): string {
  const { sourceText, sourceLabel, plan, additionalContext, avoidQuestions } = params;
  const types = plan.filter((p) => p.EASY + p.MEDIUM + p.DIFFICULT > 0).map((p) => p.question_type);
  const requestedSchemas = types
    .filter((t) => TYPE_SCHEMAS[t])
    .map((t) => TYPE_SCHEMAS[t])
    .join("\n\n");
  const total = planTotal(plan);
  const avoid = (avoidQuestions || []).filter(Boolean).slice(0, 40);

  return `You are an expert educational question designer. Generate quiz questions strictly based on the provided source material${sourceLabel ? ` (${sourceLabel})` : ""}.

SOURCE MATERIAL:
---
${sourceText}
---

TASK:
Generate exactly ${total} question(s), with this exact breakdown by type and difficulty:
${describePlan(plan)}
- Base ALL questions on information present in the source material above
- Every question must set "difficulty_level" to the level it was planned for
- question_text must be plain text (no HTML tags)
- Vary the sub-topics covered; do not ask the same thing twice${additionalContext ? `\n- Teacher's instructions (follow them unless they contradict the rules above): ${additionalContext}` : ""}${avoid.length ? `\n- These questions already exist; do NOT repeat or paraphrase them:\n${avoid.map((q) => `  * ${q.slice(0, 200)}`).join("\n")}` : ""}

${DIFFICULTY_GUIDE}

${bloomPromptSection()}

OUTPUT FORMAT:
Respond ONLY with a valid JSON array. No markdown, no code fences, no explanation text.
Every element must follow this root schema:
{
  "question_type": "<one of: ${types.join("|")}>",
  "question_text": "<the question as plain text>",
  "question_data": { <type-specific object per schemas below> },
  "correct_answer": <type-specific object or null>,
  "explanation": "<brief explanation of the correct answer>",
  "difficulty_level": "<EASY|MEDIUM|DIFFICULT, as planned>",
  "blooms_level": <1-6, the Bloom's level this question actually demands, within its difficulty band>,
  "tags": ["<1-3 lowercase topic tags from the source>"],
  "time_limit_seconds": <number between 30 and 300; harder questions get more time>
}

TYPE-SPECIFIC SCHEMAS (only these types are requested):

${requestedSchemas}

Generate the ${total} questions now. Return ONLY the JSON array, nothing else.`;
}

/** Legacy single-difficulty request, expressed as a plan. */
export function buildGenerateFromDocumentPrompt(params: AIGenerateFromDocumentParams): string {
  const { documentText, questionTypes, countPerType, difficulty, additionalContext } = params;
  return buildGenerateFromSourcePrompt({
    sourceText: documentText,
    plan: questionTypes.map((t) => ({
      question_type: t,
      EASY: difficulty === "EASY" ? countPerType : 0,
      MEDIUM: difficulty === "MEDIUM" ? countPerType : 0,
      DIFFICULT: difficulty === "DIFFICULT" ? countPerType : 0,
    })),
    additionalContext,
  });
}
