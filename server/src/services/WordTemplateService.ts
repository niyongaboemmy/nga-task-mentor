import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
} from "docx";

export class WordTemplateService {
  static async generateTemplate(): Promise<Buffer> {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Question Bank Upload Template",
                  bold: true,
                  size: 32,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: "Instructions: ",
                  bold: true,
                }),
                new TextRun(
                  "Follow the format below for each question. Separate questions with '---' or three new lines. Question labels can be numbered (e.g., 'Question 1:' or 'Q1:').",
                ),
              ],
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun("---")] }),
            new Paragraph({ children: [new TextRun("")] }),

            // Single Choice Example
            ...this.createQuestionBlock({
              index: 1,
              question: "What is the capital of France?",
              type: "single_choice",
              difficulty: "EASY",
              blooms: "Remembering",
              duration: 30,
              tags: ["geography", "europe", "capitals"],
              data: [
                "A) London",
                "B) Paris",
                "C) Berlin",
                "D) Madrid",
                "Correct: B",
              ],
              explanation:
                "Paris is the capital and most populous city of France.",
            }),

            new Paragraph({ children: [new TextRun("---")] }),

            // Multiple Choice Example
            ...this.createQuestionBlock({
              index: 2,
              question: "Which of these are programming languages?",
              type: "multiple_choice",
              difficulty: "MEDIUM",
              blooms: "Understanding",
              duration: 60,
              tags: ["programming", "basics"],
              data: [
                "A) Python",
                "B) HTML",
                "C) Java",
                "D) CSS",
                "Correct: A, C",
              ],
              explanation:
                "Python and Java are programming languages, while HTML and CSS are markup/styling languages.",
            }),

            new Paragraph({ children: [new TextRun("---")] }),

            // True/False Example
            ...this.createQuestionBlock({
              index: 3,
              question: "The Earth is flat.",
              type: "true_false",
              difficulty: "EASY",
              blooms: "Remembering",
              duration: 30,
              tags: ["science", "astronomy"],
              data: ["Correct: False"],
              explanation: "The Earth is an oblate spheroid.",
            }),

            new Paragraph({ children: [new TextRun("---")] }),

            // Short Answer Example
            ...this.createQuestionBlock({
              index: 4,
              question: "Explain the concept of 'Hoisting' in JavaScript.",
              type: "short_answer",
              difficulty: "DIFFICULT",
              blooms: "Analyzing",
              duration: 120,
              tags: ["javascript", "programming", "advanced"],
              data: ["Keywords: variable, declaration, top, scope"],
              explanation:
                "Hoisting is a JavaScript mechanism where variables and function declarations are moved to the top of their scope before code execution.",
            }),

            new Paragraph({ children: [new TextRun("---")] }),

            // Matching Example
            ...this.createQuestionBlock({
              index: 5,
              question: "Match the capitals to their countries.",
              type: "matching",
              difficulty: "MEDIUM",
              blooms: "Applying",
              duration: 90,
              tags: ["geography", "capitals"],
              data: [
                "Paris <-> France",
                "Berlin <-> Germany",
                "Rome <-> Italy",
              ],
              explanation:
                "Classic European capitals and their respective nations.",
            }),

            new Paragraph({ children: [new TextRun("---")] }),

            // Ordering Example
            ...this.createQuestionBlock({
              index: 6,
              question:
                "Order the planets by their distance from the Sun (closest first).",
              type: "ordering",
              difficulty: "MEDIUM",
              blooms: "Analyzing",
              duration: 90,
              tags: ["space", "astronomy", "planets"],
              data: ["1. Mercury", "2. Venus", "3. Earth", "4. Mars"],
              explanation: "The inner four terrestrial planets in order.",
            }),

            new Paragraph({ children: [new TextRun("---")] }),

            // Fill in the Blank Example
            ...this.createQuestionBlock({
              index: 7,
              question:
                "The [blank] is the largest planet in our solar system.",
              type: "fill_blank",
              difficulty: "EASY",
              blooms: "Remembering",
              duration: 45,
              tags: ["stronomy", "planets"],
              data: ["Correct: Jupiter"],
              explanation: "Jupiter is a gas giant and the largest planet.",
            }),

            new Paragraph({ children: [new TextRun("---")] }),

            // Numerical Example
            ...this.createQuestionBlock({
              index: 8,
              question: "What is the square root of 64?",
              type: "numerical",
              difficulty: "EASY",
              blooms: "Applying",
              duration: 45,
              tags: ["math", "arithmetic", "roots"],
              data: ["Correct: 8", "Tolerance: 0"],
              explanation: "8 * 8 = 64.",
            }),

            new Paragraph({ children: [new TextRun("---")] }),

            // Dropdown Example
            ...this.createQuestionBlock({
              index: 9,
              question:
                "The {{dropdown}} is the process where {{dropdown}} are converted into {{dropdown}}.",
              type: "dropdown",
              difficulty: "MEDIUM",
              blooms: "Understanding",
              duration: 90,
              tags: ["science", "biology"],
              data: [
                "0: Photosynthesis, Respiration | Photosynthesis",
                "1: Light energy, Heat | Light energy",
                "2: Chemical energy, Kinetic energy | Chemical energy",
              ],
              explanation:
                "Photosynthesis converts light energy into chemical energy.",
            }),

            new Paragraph({ children: [new TextRun("---")] }),

            // Algorithmic Example
            ...this.createQuestionBlock({
              index: 10,
              question: "Calculate the factorial of a non-negative integer n.",
              type: "algorithmic",
              difficulty: "MEDIUM",
              blooms: "Applying",
              duration: 300,
              tags: ["algorithms", "math", "recursion"],
              data: [
                "Code: function factorial(n) { return n <= 1 ? 1 : n * factorial(n-1); }",
                "Input Format: A single integer n",
                "Output Format: The factorial of n",
                "Constraints: 0 <= n <= 12",
                "Test Case: input=5, expected=120, points=10",
                "Test Case: input=0, expected=1, points=5",
              ],
              explanation:
                "Factorial of n is the product of all positive integers less than or equal to n.",
            }),

            new Paragraph({ children: [new TextRun("---")] }),

            // Logical Expression Example
            ...this.createQuestionBlock({
              index: 11,
              question:
                "Represent the NAND gate logic using variables A and B.",
              type: "logical_expression",
              difficulty: "EASY",
              blooms: "Applying",
              duration: 120,
              tags: ["logic", "gates", "boolean"],
              data: [
                "Variable: name=A, description=Input A, type=boolean",
                "Variable: name=B, description=Input B, type=boolean",
                "Correct Expression: !(A && B)",
                "Truth Table: A=true, B=true -> false",
                "Truth Table: A=true, B=false -> true",
              ],
              explanation: "NAND is the negation of the AND operation.",
            }),

            new Paragraph({ children: [new TextRun("---")] }),

            // Drag and Drop Example
            ...this.createQuestionBlock({
              index: 12,
              question: "Place the labels on the correct parts of the tree.",
              type: "drag_drop",
              difficulty: "EASY",
              blooms: "Remembering",
              duration: 120,
              tags: ["biology", "botany"],
              data: [
                "Background: https://example.com/tree-diagram.png",
                "Draggable: id=leaf, text=Leaf, value=foliage",
                "Draggable: id=root, text=Root, value=base",
                "Drop Zone: id=zone1, x=100, y=50, width=60, height=40, correct=leaf, label=Top",
                "Drop Zone: id=zone2, x=100, y=300, width=60, height=40, correct=root, label=Bottom",
              ],
              explanation: "Leaves are at the top, roots are at the bottom.",
            }),
          ],
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  private static createQuestionBlock(opts: {
    index?: number;
    question: string;
    type: string;
    difficulty: string;
    blooms: string;
    duration: number;
    tags: string[];
    data: string[];
    explanation: string;
  }) {
    const questionLabel = opts.index
      ? `Question ${opts.index}: `
      : "Question: ";
    return [
      new Paragraph({
        children: [
          new TextRun({ text: questionLabel, bold: true }),
          new TextRun(opts.question),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Type: ", bold: true }),
          new TextRun(opts.type),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Difficulty: ", bold: true }),
          new TextRun(opts.difficulty),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Blooms: ", bold: true }),
          new TextRun(opts.blooms),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Duration: ", bold: true }),
          new TextRun(opts.duration.toString()),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Tags: ", bold: true }),
          new TextRun(opts.tags.join(", ")),
        ],
      }),
      new Paragraph({
        children: [new TextRun({ text: "Data:", bold: true })],
      }),
      ...opts.data.map(
        (line) =>
          new Paragraph({
            children: [new TextRun(line)],
            indent: { left: 720 },
          }),
      ),
      new Paragraph({
        children: [
          new TextRun({ text: "Explanation: ", bold: true }),
          new TextRun(opts.explanation),
        ],
      }),
    ];
  }
}
