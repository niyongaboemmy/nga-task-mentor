import * as XLSX from "xlsx";
import { QuestionType, DifficultyLevel } from "../types/quiz.types";
import { HandlerFactory } from "./question-handlers/HandlerFactory";

interface ParsedQuestion {
  question_type: QuestionType;
  question_text: string;
  question_data: any;
  correct_answer?: any;
  explanation?: string;
  difficulty_level?: DifficultyLevel;
  tags?: string[];
  blooms_level_name?: string;
  time_limit_seconds?: number;
}

// Column indices (0-based), matching the template header row
const COL = {
  NUM: 0,
  QUESTION_TEXT: 1,
  TYPE: 2,
  DIFFICULTY: 3,
  BLOOMS: 4,
  DURATION: 5,
  TAGS: 6,
  EXPLANATION: 7,
  OPTION_A: 8,
  OPTION_B: 9,
  OPTION_C: 10,
  OPTION_D: 11,
  CORRECT_ANSWER: 12,
  TOLERANCE: 13,
  KEYWORDS: 14,
  MATCH_PAIRS: 15,
  ORDER_ITEMS: 16,
  EXTRA_DATA: 17,
};

// Rows 0–2: instructions/blank, row 3: headers, data starts at row 4
const DATA_START_ROW = 4;

function str(val: any): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function buildDataParagraphs(row: any[], type: QuestionType): string[] {
  const paragraphs: string[] = [];

  const optA = str(row[COL.OPTION_A]);
  const optB = str(row[COL.OPTION_B]);
  const optC = str(row[COL.OPTION_C]);
  const optD = str(row[COL.OPTION_D]);
  const correct = str(row[COL.CORRECT_ANSWER]);
  const tolerance = str(row[COL.TOLERANCE]);
  const keywords = str(row[COL.KEYWORDS]);
  const matchPairs = str(row[COL.MATCH_PAIRS]);
  const orderItems = str(row[COL.ORDER_ITEMS]);
  const extraData = str(row[COL.EXTRA_DATA]);

  switch (type) {
    case "single_choice":
    case "multiple_choice":
      if (optA) paragraphs.push(`A) ${optA}`);
      if (optB) paragraphs.push(`B) ${optB}`);
      if (optC) paragraphs.push(`C) ${optC}`);
      if (optD) paragraphs.push(`D) ${optD}`);
      if (correct) paragraphs.push(`Correct: ${correct}`);
      break;

    case "true_false":
      if (correct) paragraphs.push(`Correct: ${correct}`);
      break;

    case "matching":
      if (matchPairs) {
        matchPairs.split("|").forEach((pair) => {
          const trimmed = pair.trim();
          if (trimmed) paragraphs.push(trimmed);
        });
      }
      break;

    case "ordering":
      if (orderItems) {
        orderItems.split("|").forEach((item, i) => {
          const trimmed = item.trim();
          if (trimmed) paragraphs.push(`${i + 1}. ${trimmed}`);
        });
      }
      break;

    case "fill_blank":
      if (correct) paragraphs.push(`Correct: ${correct}`);
      break;

    case "numerical":
      if (correct) paragraphs.push(`Correct: ${correct}`);
      if (tolerance) paragraphs.push(`Tolerance: ${tolerance}`);
      break;

    case "short_answer":
      if (keywords) paragraphs.push(`Keywords: ${keywords}`);
      break;

    default:
      // dropdown, algorithmic, logical_expression, drag_drop
      // Uses "||" (double-pipe) as line separator to avoid conflicting with the single "|"
      // used inside dropdown entries to separate option list from correct answer.
      if (extraData) {
        extraData.split("||").forEach((line) => {
          const trimmed = line.trim();
          if (trimmed) paragraphs.push(trimmed);
        });
      }
      break;
  }

  return paragraphs;
}

function mapType(typeStr: string): QuestionType {
  const map: Record<string, QuestionType> = {
    single_choice: "single_choice",
    "single choice": "single_choice",
    multiple_choice: "multiple_choice",
    "multiple choice": "multiple_choice",
    true_false: "true_false",
    "true/false": "true_false",
    "true false": "true_false",
    short_answer: "short_answer",
    "short answer": "short_answer",
    matching: "matching",
    ordering: "ordering",
    fill_blank: "fill_blank",
    "fill blank": "fill_blank",
    "fill in the blank": "fill_blank",
    numerical: "numerical",
    dropdown: "dropdown",
    algorithmic: "algorithmic",
    algorithm: "algorithmic",
    logical_expression: "logical_expression",
    "logical expression": "logical_expression",
    drag_drop: "drag_drop",
    "drag drop": "drag_drop",
    "drag and drop": "drag_drop",
    coding: "coding",
  };
  const normalized = typeStr.toLowerCase().trim();
  return map[normalized] || (normalized.replace(/\s+/g, "_") as QuestionType);
}

export class ExcelParserService {
  static parseXlsx(buffer: Buffer): ParsedQuestion[] {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    // Convert to array-of-arrays; raw:true to avoid XLSX converting numbers to dates etc.
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: false,
      defval: "",
    });

    const questions: ParsedQuestion[] = [];

    for (let i = DATA_START_ROW; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((cell) => str(cell) === "")) continue;

      const questionText = str(row[COL.QUESTION_TEXT]);
      if (!questionText) continue;

      const typeRaw = str(row[COL.TYPE]);
      if (!typeRaw) continue;

      const type = mapType(typeRaw);
      const difficultyRaw = str(row[COL.DIFFICULTY]).toUpperCase();
      const difficulty: DifficultyLevel =
        difficultyRaw === "EASY" || difficultyRaw === "MEDIUM" || difficultyRaw === "DIFFICULT"
          ? (difficultyRaw as DifficultyLevel)
          : "MEDIUM";

      const bloomsLevelName = str(row[COL.BLOOMS]);
      const durationRaw = str(row[COL.DURATION]);
      const timeLimitSeconds = durationRaw ? parseInt(durationRaw) || 60 : 60;
      const tagsRaw = str(row[COL.TAGS]);
      const tags = tagsRaw
        ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
        : [];
      const explanation = str(row[COL.EXPLANATION]);

      const dataParagraphs = buildDataParagraphs(row, type);
      const handler = HandlerFactory.getHandler(type);
      const parsedData = handler
        ? handler.handle(dataParagraphs, questionText)
        : { question_data: {} };

      questions.push({
        question_text: questionText,
        question_type: type,
        difficulty_level: difficulty,
        explanation: explanation || undefined,
        tags: tags.length ? tags : undefined,
        blooms_level_name: bloomsLevelName || undefined,
        time_limit_seconds: timeLimitSeconds,
        question_data: parsedData.question_data,
        correct_answer: parsedData.correct_answer,
      });
    }

    return questions;
  }
}
