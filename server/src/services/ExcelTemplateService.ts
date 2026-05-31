import * as XLSX from "xlsx";

export class ExcelTemplateService {
  static generateTemplate(): Buffer {
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Questions ──────────────────────────────────────────────────
    const headers = [
      "#",
      "Question Text",
      "Type",
      "Difficulty",
      "Blooms Level",
      "Duration (sec)",
      "Tags",
      "Explanation",
      "Option A",
      "Option B",
      "Option C",
      "Option D",
      "Correct Answer",
      "Tolerance",
      "Keywords",
      "Match Pairs",
      "Order Items",
      "Extra Data",
    ];

    const instructions = [
      [
        "Question Bank Upload Template — Fill rows below the header. Do NOT delete rows 1–4. Separate multiple tags with commas. For 'Extra Data' column use double-pipe ( || ) to separate lines (single | is reserved inside dropdown entries).",
      ],
      [],
      [],
      headers,
    ];

    const samples: any[][] = [
      // 1. single_choice
      [
        1,
        "What is the capital of France?",
        "single_choice",
        "EASY",
        "Remembering",
        30,
        "geography, europe",
        "Paris is the capital and most populous city of France.",
        "London",
        "Paris",
        "Berlin",
        "Madrid",
        "B",
        "",
        "",
        "",
        "",
        "",
      ],
      // 2. multiple_choice
      [
        2,
        "Which of the following are programming languages?",
        "multiple_choice",
        "MEDIUM",
        "Understanding",
        60,
        "programming, basics",
        "Python and Java are programming languages. HTML and CSS are markup/styling languages.",
        "Python",
        "HTML",
        "Java",
        "CSS",
        "A, C",
        "",
        "",
        "",
        "",
        "",
      ],
      // 3. true_false
      [
        3,
        "The Earth is flat.",
        "true_false",
        "EASY",
        "Remembering",
        30,
        "science, astronomy",
        "The Earth is an oblate spheroid.",
        "",
        "",
        "",
        "",
        "False",
        "",
        "",
        "",
        "",
        "",
      ],
      // 4. matching
      [
        4,
        "Match each country to its capital city.",
        "matching",
        "MEDIUM",
        "Applying",
        90,
        "geography, capitals",
        "Classic European capitals and their respective nations.",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "Paris <-> France | Berlin <-> Germany | Rome <-> Italy",
        "",
        "",
      ],
      // 5. fill_blank
      [
        5,
        "The [blank] is the largest planet in our solar system.",
        "fill_blank",
        "EASY",
        "Remembering",
        45,
        "astronomy, planets",
        "Jupiter is a gas giant and the largest planet in our solar system.",
        "",
        "",
        "",
        "",
        "Jupiter",
        "",
        "",
        "",
        "",
        "",
      ],
      // 6. dropdown
      [
        6,
        "The {{dropdown}} is the process where {{dropdown}} is converted into {{dropdown}}.",
        "dropdown",
        "MEDIUM",
        "Understanding",
        90,
        "science, biology",
        "Photosynthesis converts light energy into chemical energy.",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "0: Photosynthesis, Respiration | Photosynthesis||1: Light energy, Heat | Light energy||2: Chemical energy, Kinetic energy | Chemical energy",
      ],
      // 7. numerical
      [
        7,
        "What is the square root of 64?",
        "numerical",
        "EASY",
        "Applying",
        45,
        "math, arithmetic",
        "8 × 8 = 64.",
        "",
        "",
        "",
        "",
        "8",
        "0",
        "",
        "",
        "",
        "",
      ],
      // 8. algorithmic
      [
        8,
        "Calculate the factorial of a non-negative integer n.",
        "algorithmic",
        "MEDIUM",
        "Applying",
        300,
        "algorithms, math, recursion",
        "Factorial of n is the product of all positive integers up to n.",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "Code: function factorial(n) { return n <= 1 ? 1 : n * factorial(n-1); }||Input Format: A single integer n||Output Format: The factorial of n||Constraints: 0 <= n <= 12||Test Case: input=5, expected=120, points=10||Test Case: input=0, expected=1, points=5",
      ],
      // 9. short_answer
      [
        9,
        "Explain the concept of 'Hoisting' in JavaScript.",
        "short_answer",
        "DIFFICULT",
        "Analyzing",
        120,
        "javascript, programming",
        "Hoisting moves variable and function declarations to the top of their scope before execution.",
        "",
        "",
        "",
        "",
        "",
        "",
        "variable, declaration, top, scope",
        "",
        "",
        "",
      ],
      // 10. logical_expression
      [
        10,
        "Represent the NAND gate logic using variables A and B.",
        "logical_expression",
        "EASY",
        "Applying",
        120,
        "logic, gates, boolean",
        "NAND is the negation of the AND operation.",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "Variable: name=A, description=Input A, type=boolean||Variable: name=B, description=Input B, type=boolean||Correct Expression: !(A && B)||Truth Table: A=true, B=true -> false||Truth Table: A=true, B=false -> true",
      ],
      // 11. drag_drop
      [
        11,
        "Place the labels on the correct parts of the tree diagram.",
        "drag_drop",
        "EASY",
        "Remembering",
        120,
        "biology, botany",
        "Leaves are at the top; roots are at the bottom.",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "Draggable: id=leaf, text=Leaf, value=foliage||Draggable: id=root, text=Root, value=base||Drop Zone: id=zone1, x=100, y=50, width=60, height=40, correct=leaf, label=Top||Drop Zone: id=zone2, x=100, y=300, width=60, height=40, correct=root, label=Bottom",
      ],
      // 12. ordering
      [
        12,
        "Order the planets by their distance from the Sun (closest first).",
        "ordering",
        "MEDIUM",
        "Analyzing",
        90,
        "astronomy, planets, space",
        "The inner four terrestrial planets in order from the Sun.",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "Mercury | Venus | Earth | Mars",
        "",
      ],
    ];

    const wsData = [...instructions, ...samples];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws["!cols"] = [
      { wch: 4 },   // #
      { wch: 50 },  // Question Text
      { wch: 20 },  // Type
      { wch: 12 },  // Difficulty
      { wch: 16 },  // Blooms Level
      { wch: 14 },  // Duration
      { wch: 24 },  // Tags
      { wch: 40 },  // Explanation
      { wch: 18 },  // Option A
      { wch: 18 },  // Option B
      { wch: 18 },  // Option C
      { wch: 18 },  // Option D
      { wch: 16 },  // Correct Answer
      { wch: 10 },  // Tolerance
      { wch: 28 },  // Keywords
      { wch: 40 },  // Match Pairs
      { wch: 36 },  // Order Items
      { wch: 60 },  // Extra Data
    ];

    // Merge instruction cell across all columns
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 17 } }];

    XLSX.utils.book_append_sheet(wb, ws, "Questions");

    // ── Sheet 2: Reference Guide ────────────────────────────────────────────
    const refData = [
      ["Column Reference Guide"],
      [],
      ["Column", "Name", "Notes"],
      ["A", "#", "Row number (informational only)"],
      ["B", "Question Text", "The question text. Use [blank] for fill_blank type. Use {{dropdown}} placeholders for dropdown type."],
      ["C", "Type", "One of: single_choice | multiple_choice | true_false | matching | fill_blank | dropdown | numerical | algorithmic | short_answer | logical_expression | drag_drop | ordering"],
      ["D", "Difficulty", "EASY | MEDIUM | DIFFICULT"],
      ["E", "Blooms Level", "Remembering | Understanding | Applying | Analyzing | Evaluating | Creating"],
      ["F", "Duration (sec)", "Time limit in seconds (e.g. 30, 60, 120)"],
      ["G", "Tags", "Comma-separated tags (e.g. math, algebra, grade-10)"],
      ["H", "Explanation", "Text shown to students after answering"],
      ["I–L", "Option A–D", "Answer choices for single_choice and multiple_choice"],
      ["M", "Correct Answer", "single_choice: letter (A/B/C/D) | multiple_choice: letters comma-separated (A, C) | true_false: True or False | numerical: the number | fill_blank: the answer text"],
      ["N", "Tolerance", "For numerical type only. Acceptable ± margin (e.g. 0.5)"],
      ["O", "Keywords", "For short_answer type. Comma-separated keywords that must appear in student answer."],
      ["P", "Match Pairs", "For matching type. Format: Left1 <-> Right1 | Left2 <-> Right2 (use pipe | to separate pairs)"],
      ["Q", "Order Items", "For ordering type. Items in correct order, separated by pipe ( | ). E.g. Mercury | Venus | Earth | Mars"],
      ["R", "Extra Data", "For dropdown, algorithmic, logical_expression, drag_drop. Use double-pipe ( || ) to separate data lines. Single pipe ( | ) is reserved inside dropdown entries to separate options from the correct answer. See examples in Questions sheet."],
      [],
      ["Extra Data format per type"],
      [],
      ["dropdown", "", "0: Option1, Option2 | Correct||1: Option1, Option2 | Correct  (one entry per {{dropdown}} placeholder; use || between entries, | between options and correct answer)"],
      ["algorithmic", "", "Code: <code>||Input Format: <text>||Output Format: <text>||Constraints: <text>||Test Case: input=<val>, expected=<val>, points=<n>"],
      ["logical_expression", "", "Variable: name=A, description=Input A, type=boolean||Correct Expression: !(A && B)||Truth Table: A=true, B=true -> false"],
      ["drag_drop", "", "Draggable: id=<id>, text=<text>, value=<val>||Drop Zone: id=<id>, x=<n>, y=<n>, width=<n>, height=<n>, correct=<draggable_id>, label=<text>"],
    ];

    const wsRef = XLSX.utils.aoa_to_sheet(refData);
    wsRef["!cols"] = [{ wch: 20 }, { wch: 20 }, { wch: 80 }];
    wsRef["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];

    XLSX.utils.book_append_sheet(wb, wsRef, "Reference Guide");

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }
}
