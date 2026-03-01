import { WordParserService } from "../services/WordParserService";
import { HandlerFactory } from "../services/question-handlers/HandlerFactory";

// Mock Text Block
const sampleHtml = `
<p>Q: What is <strong>2+2</strong>?</p>
<p>Type: Single Choice</p>
<p>Difficulty: EASY</p>
<p>Explanation: Simple addition.</p>
<p>Tags: math, basic</p>
<p>Blooms: Remember</p>
<p>Data:</p>
<p>A. 3</p>
<p><strong>B.</strong> 4</p>
<p>C. 5</p>
<p>Correct: B</p>
<p>---</p>
<p>Question: Which are <em>planets</em>?</p>
<p>Type: Multiple Choice</p>
<p>Data:</p>
<p>1. Mars</p>
<p>2. Sun</p>
<p>3. Jupiter</p>
<p>4. Moon</p>
<p>Correct: 1, 3</p>
<p>---</p>
<p>Q: The earth is flat.</p>
<p>Type: True/False</p>
<p>Data:</p>
<p>Correct: False</p>
<p>---</p>
<p>Q: Define <strong>Photosynthesis</strong>.</p>
<p>Type: Short Answer</p>
<p>Data:</p>
<p>Keywords: light, chlorophyll, glucose</p>
<p>---</p>
<p>Q: Match the <em>Capitals</em>.</p>
<p>Type: Matching</p>
<p>Difficulty: MEDIUM</p>
<p>Data:</p>
<p>Paris &lt;-&gt; France</p>
<p>Berlin &lt;-&gt; Germany</p>
<p>---</p>
<p>Q: Order the <u>steps</u>.</p>
<p>Type: Ordering</p>
<p>Difficulty: MEDIUM</p>
<p>Data:</p>
<p>1. Start</p>
<p>2. Middle</p>
<p>3. End</p>
<p>---</p>
<p>Q: The [blank] is blue.</p>
<p>Type: Fill in the Blank</p>
<p>Difficulty: EASY</p>
<p>Data:</p>
<p>Correct: sky</p>
<p>---</p>
<p>Q: What is the square root of 16?</p>
<p>Type: Numerical</p>
<p>Difficulty: EASY</p>
<p>Data:</p>
<p>Correct: 4</p>
<p>Tolerance: 0.1</p>
`;

async function runTests() {
  console.log("🚀 Running Enhanced Docx Parser Tests...");

  // @ts-ignore - access private method for testing
  const questions = WordParserService.parseHtml(sampleHtml);

  console.log(`Parsed ${questions.length} questions.`);

  // Test 1: Single Choice with HTML and Bold Identifier
  const q1 = questions[0];
  const q1TextOnly = q1.question_text.replace(/<[^>]*>/g, "").trim();
  if (
    q1.question_type === "single_choice" &&
    q1.question_data.options.length === 3 &&
    q1.question_data.correct_option_index === 1 &&
    q1.question_data.options[1].trim() === "4" &&
    q1TextOnly === "What is 2+2?"
  ) {
    console.log("✅ Test 1 Passed: Single Choice (HTML)");
  } else {
    console.error(
      "❌ Test 1 Failed: Single Choice (HTML)",
      JSON.stringify(q1, null, 2),
    );
  }

  // Test 2: Multiple Choice with Italics
  const q2 = questions[1];
  const q2TextOnly = q2.question_text.replace(/<[^>]*>/g, "").trim();
  if (
    q2.question_type === "multiple_choice" &&
    q2.question_data.options.length === 4 &&
    q2.question_data.correct_option_indices.length === 2 &&
    q2TextOnly === "Which are planets?"
  ) {
    console.log("✅ Test 2 Passed: Multiple Choice (HTML)");
  } else {
    console.error(
      "❌ Test 2 Failed: Multiple Choice (HTML)",
      JSON.stringify(q2, null, 2),
    );
  }

  // Test 3: True/False
  const q3 = questions[2];
  if (
    q3.question_type === "true_false" &&
    q3.question_data.correct_answer === false
  ) {
    console.log("✅ Test 3 Passed: True/False (HTML)");
  } else {
    console.error(
      "❌ Test 3 Failed: True/False (HTML)",
      JSON.stringify(q3, null, 2),
    );
  }

  // Test 4: Short Answer
  const q4 = questions[3];
  if (
    q4.question_type === "short_answer" &&
    q4.question_data.keywords.includes("light")
  ) {
    console.log("✅ Test 4 Passed: Short Answer (HTML)");
  } else {
    console.error(
      "❌ Test 4 Failed: Short Answer (HTML)",
      JSON.stringify(q4, null, 2),
    );
  }

  // Test 5: Matching
  const q5 = questions[4];
  if (
    q5.question_type === "matching" &&
    q5.question_data.left_items.length === 2 &&
    q5.question_data.right_items.length === 2
  ) {
    console.log("✅ Test 5 Passed: Matching");
  } else {
    console.error("❌ Test 5 Failed: Matching", JSON.stringify(q5, null, 2));
  }

  // Test 6: Ordering
  const q6 = questions[5];
  if (
    q6.question_type === "ordering" &&
    q6.question_data.items.length === 3 &&
    q6.question_data.items[0].text.includes("Start")
  ) {
    console.log("✅ Test 6 Passed: Ordering");
  } else {
    console.error("❌ Test 6 Failed: Ordering", JSON.stringify(q6, null, 2));
  }

  // Test 7: Fill in the Blank
  const q7 = questions[6];
  if (
    q7.question_type === "fill_blank" &&
    q7.question_data.acceptable_answers[0].answers[0] === "sky"
  ) {
    console.log("✅ Test 7 Passed: Fill in the Blank");
  } else {
    console.error(
      "❌ Test 7 Failed: Fill in the Blank",
      JSON.stringify(q7, null, 2),
    );
  }

  // Test 8: Numerical
  const q8 = questions[7];
  if (
    q8.question_type === "numerical" &&
    q8.question_data.correct_answer === 4 &&
    q8.question_data.tolerance === 0.1
  ) {
    console.log("✅ Test 8 Passed: Numerical");
  } else {
    console.error("❌ Test 8 Failed: Numerical", JSON.stringify(q8, null, 2));
  }

  console.log("\n🏁 All tests completed.");
}

runTests().catch(console.error);
