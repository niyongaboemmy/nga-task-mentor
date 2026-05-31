import mammoth from "mammoth";
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

export class WordParserService {
  static async parseDocx(buffer: Buffer): Promise<ParsedQuestion[]> {
    const options = {
      convertImage: mammoth.images.imgElement((element: any) => {
        return element.read("base64").then((imageBuffer: string) => {
          return {
            src: `data:${element.contentType};base64,${imageBuffer}`,
          };
        });
      }),
    };

    const result = await mammoth.convertToHtml({ buffer }, options);
    const html = result.value;
    return this.parseHtml(html);
  }

  private static parseHtml(html: string): ParsedQuestion[] {
    const questions: ParsedQuestion[] = [];
    // Split by <p>---</p> or multiple <p></p> or just horizontal lines if mammoth produces them
    // Mammoth usually produces <p>---</p> for page breaks or sequences of dashes
    const blocks = html.split(/<p>---<\/p>|<hr\s*\/?>/i);

    for (const block of blocks) {
      if (!block.trim()) continue;

      const question = this.parseQuestionBlock(block);
      if (question) {
        questions.push(question);
      }
    }

    return questions;
  }

  // Decode safe HTML entities that mammoth inserts for special chars in plain text.
  // We intentionally skip &lt; / &gt; to avoid turning encoded angle-brackets into
  // real HTML tags, which would confuse the subsequent tag-stripping regexes.
  private static decodeEntities(str: string): string {
    // Decode &amp; first (must be before others to avoid double-decoding).
    // We intentionally decode &gt; (>) but NOT &lt; (<): decoding &lt; would turn
    // encoded angle-brackets into real HTML tags and confuse the tag-stripping regex.
    // Decoding only &gt; is safe because an unmatched > cannot start a new HTML tag.
    return str
      .replace(/&amp;/g, "&")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
  }

  private static parseQuestionBlock(block: string): ParsedQuestion | null {
    // In HTML, we can't just split by \n and trim easily because formatting might be multi-line
    // We'll use a regex-based extraction or a simple "line-by-paragraph" approach
    const paragraphs = block
      .split(/<\/(?:p|div|h[1-6])>|<br\s*\/?>/i)
      .map((p) => p.replace(/<(?:p|div|h[1-6])>/gi, "").trim())
      .filter((p) => {
        const textOnly = p
          .replace(/<[^>]*>/g, "")
          .trim()
          .toLowerCase();
        // Ignore the literal template header and instructions
        if (
          textOnly === "question bank upload template" ||
          textOnly.startsWith("instructions:") ||
          textOnly === "---" ||
          textOnly.match(/^\d+\.\s+[a-z\s\/]+example$/)
        ) {
          return false;
        }
        return p.length > 0;
      });

    if (paragraphs.length === 0) return null;

    let questionHtml = "";
    let type: QuestionType = "single_choice";
    let difficulty: DifficultyLevel = "MEDIUM";
    let explanation = "";
    let tags: string[] = [];
    let bloomsLevelName = "";
    let timeLimitSeconds = 60;
    let dataParagraphs: string[] = [];
    let isParsingData = false;

    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      const textOnly = this.decodeEntities(p.replace(/<[^>]*>/g, ""))
        .trim()
        .toLowerCase();

      if (/^(?:<[^>]*>)*(?:q|question)\s*\d*:/i.test(textOnly)) {
        questionHtml = p
          .replace(/^(?:<[^>]*>)*(?:q|question)\s*\d*:\s*(?:<[^>]*>)*/i, "")
          .trim();
      } else if (textOnly.startsWith("type:")) {
        const typeStr = textOnly.replace(/^type:/i, "").trim();
        type = this.mapType(typeStr);
      } else if (textOnly.startsWith("difficulty:")) {
        difficulty = textOnly
          .replace(/^difficulty:/i, "")
          .trim()
          .toUpperCase() as DifficultyLevel;
      } else if (textOnly.startsWith("explanation:")) {
        explanation = p.replace(/^(<[^>]*>)?explanation:/i, "").trim();
      } else if (textOnly.startsWith("tags:")) {
        tags = p
          .replace(/^(<[^>]*>)?tags:/i, "")
          .split(",")
          .map((t) => t.replace(/<[^>]*>?/gm, "").trim())
          .filter((t) => t.length > 0);
      } else if (textOnly.startsWith("blooms:")) {
        bloomsLevelName = p
          .replace(/^(<[^>]*>)?blooms:/i, "")
          .replace(/<[^>]*>?/gm, "")
          .trim();
      } else if (
        textOnly.startsWith("duration:") ||
        textOnly.startsWith("time limit:")
      ) {
        const val = textOnly.replace(/^(duration|time limit):/i, "").trim();
        timeLimitSeconds = parseInt(val) || 60;
      } else if (textOnly.startsWith("data:")) {
        isParsingData = true;
      } else if (isParsingData) {
        dataParagraphs.push(this.decodeEntities(p));
      } else {
        if (!questionHtml) {
          questionHtml = p;
        } else {
          questionHtml += `<br/>${p}`;
        }
      }
    }

    // A valid question MUST have some data OR have a Question: prefix
    // If it's just raw text without any data:, we check if it's too short or smells like a header
    if (
      !questionHtml ||
      (!isParsingData &&
        !/^(q|question)\s*\d*:/i.test(paragraphs[0]?.toLowerCase()))
    ) {
      const textOnly = questionHtml
        .replace(/<[^>]*>/g, "")
        .trim()
        .toLowerCase();
      if (
        textOnly === "question bank upload template" ||
        textOnly.startsWith("instructions:")
      ) {
        return null;
      }
    }

    if (!questionHtml) return null;

    const handler = HandlerFactory.getHandler(type);
    const parsedData = handler
      ? handler.handle(dataParagraphs, questionHtml)
      : { question_data: {} };

    return {
      question_text: questionHtml,
      question_type: type,
      difficulty_level: difficulty,
      explanation,
      tags,
      blooms_level_name: bloomsLevelName,
      time_limit_seconds: timeLimitSeconds,
      question_data: parsedData.question_data,
      correct_answer: parsedData.correct_answer,
    };
  }

  private static mapType(typeStr: string): QuestionType {
    const map: Record<string, QuestionType> = {
      "single choice": "single_choice",
      "multiple choice": "multiple_choice",
      "true false": "true_false",
      "true/false": "true_false",
      "short answer": "short_answer",
      matching: "matching",
      ordering: "ordering",
      "fill in the blank": "fill_blank",
      "fill in blanks": "fill_blank",
      numerical: "numerical",
      dropdown: "dropdown",
      "statement completion": "dropdown",
      algorithmic: "algorithmic",
      algorithm: "algorithmic",
      "logical expression": "logical_expression",
      logic: "logical_expression",
      "drag and drop": "drag_drop",
      "drag drop": "drag_drop",
    };
    return map[typeStr] || (typeStr.replace(/\s+/g, "_") as QuestionType);
  }
}
