const { QuizGrader, AdvancedQuizGrader } = require("./dist/utils/quizGrader");

// Test the new grading system with normalized answers
async function testNewGradingSystem() {
  console.log("🧪 Testing New Grading System with Normalized Answers\n");

  // Test 1: True/False Question with normalized answers
  console.log("1. Testing True/False Question with Normalized Answers:");
  const trueFalseQuestion = {
    question_type: "true_false",
    points: 5,
    question_data: { correct_answer: true },
    correct_answer: true,
  };

  // Test with normalized submitted answer
  const normalizedSubmitted = AdvancedQuizGrader.normalizeAnswer(
    { selected_answer: true },
    "true_false"
  );
  const normalizedCorrect =
    AdvancedQuizGrader.normalizeCorrectAnswer(trueFalseQuestion);

  console.log("   Submitted Answer:", JSON.stringify(normalizedSubmitted.data));
  console.log("   Correct Answer:", JSON.stringify(normalizedCorrect.data));
  console.log(
    "   Should match:",
    JSON.stringify(normalizedSubmitted.data) ===
      JSON.stringify(normalizedCorrect.data)
      ? "✅"
      : "❌"
  );

  // Test 2: Single Choice Question with normalized answers
  console.log("\n2. Testing Single Choice Question with Normalized Answers:");
  const singleChoiceQuestion = {
    question_type: "single_choice",
    points: 10,
    question_data: { correct_option_index: 1 },
    correct_answer: 1,
  };

  const normalizedSubmittedSC = AdvancedQuizGrader.normalizeAnswer(
    { selected_option_index: 1 },
    "single_choice"
  );
  const normalizedCorrectSC =
    AdvancedQuizGrader.normalizeCorrectAnswer(singleChoiceQuestion);

  console.log(
    "   Submitted Answer:",
    JSON.stringify(normalizedSubmittedSC.data)
  );
  console.log("   Correct Answer:", JSON.stringify(normalizedCorrectSC.data));
  console.log(
    "   Should match:",
    JSON.stringify(normalizedSubmittedSC.data) ===
      JSON.stringify(normalizedCorrectSC.data)
      ? "✅"
      : "❌"
  );

  // Test 3: Multiple Choice Question with normalized answers
  console.log("\n3. Testing Multiple Choice Question with Normalized Answers:");
  const multipleChoiceQuestion = {
    question_type: "multiple_choice",
    points: 15,
    question_data: { correct_option_indices: [0, 2] },
    correct_answer: [0, 2],
  };

  const normalizedSubmittedMC = AdvancedQuizGrader.normalizeAnswer(
    { selected_option_indices: [0, 2] },
    "multiple_choice"
  );
  const normalizedCorrectMC = AdvancedQuizGrader.normalizeCorrectAnswer(
    multipleChoiceQuestion
  );

  console.log(
    "   Submitted Answer:",
    JSON.stringify(normalizedSubmittedMC.data)
  );
  console.log("   Correct Answer:", JSON.stringify(normalizedCorrectMC.data));
  console.log(
    "   Should match:",
    JSON.stringify(normalizedSubmittedMC.data) ===
      JSON.stringify(normalizedCorrectMC.data)
      ? "✅"
      : "❌"
  );

  // Test 4: Numerical Question with normalized answers
  console.log("\n4. Testing Numerical Question with Normalized Answers:");
  const numericalQuestion = {
    question_type: "numerical",
    points: 10,
    question_data: { correct_answer: 42 },
  };

  const normalizedSubmittedNum = AdvancedQuizGrader.normalizeAnswer(
    { answer: 42 },
    "numerical"
  );
  const normalizedCorrectNum =
    AdvancedQuizGrader.normalizeCorrectAnswer(numericalQuestion);

  console.log(
    "   Submitted Answer:",
    JSON.stringify(normalizedSubmittedNum.data)
  );
  console.log("   Correct Answer:", JSON.stringify(normalizedCorrectNum.data));
  console.log(
    "   Should match:",
    JSON.stringify(normalizedSubmittedNum.data) ===
      JSON.stringify(normalizedCorrectNum.data)
      ? "✅"
      : "❌"
  );

  // Test 5: Fill Blank Question with normalized answers
  console.log("\n5. Testing Fill Blank Question with Normalized Answers:");
  const fillBlankQuestion = {
    question_type: "fill_blank",
    points: 10,
    question_data: {
      acceptable_answers: [
        { answers: ["JavaScript"] },
        { answers: ["programming"] },
      ],
    },
  };

  const normalizedSubmittedFB = AdvancedQuizGrader.normalizeAnswer(
    {
      answers: [
        { blank_index: 0, answer: "JavaScript" },
        { blank_index: 1, answer: "programming" },
      ],
    },
    "fill_blank"
  );
  const normalizedCorrectFB =
    AdvancedQuizGrader.normalizeCorrectAnswer(fillBlankQuestion);

  console.log(
    "   Submitted Answer:",
    JSON.stringify(normalizedSubmittedFB.data)
  );
  console.log("   Correct Answer:", JSON.stringify(normalizedCorrectFB.data));
  console.log(
    "   Should match:",
    JSON.stringify(normalizedSubmittedFB.data) ===
      JSON.stringify(normalizedCorrectFB.data)
      ? "✅"
      : "❌"
  );

  // Test 6: Matching Question with normalized answers
  console.log("\n6. Testing Matching Question with Normalized Answers:");
  const matchingQuestion = {
    question_type: "matching",
    points: 15,
    question_data: {
      correct_matches: { 1: "a", 2: "b", 3: "c" },
    },
  };

  const normalizedSubmittedMatch = AdvancedQuizGrader.normalizeAnswer(
    { matches: { 1: "a", 2: "b", 3: "c" } },
    "matching"
  );
  const normalizedCorrectMatch =
    AdvancedQuizGrader.normalizeCorrectAnswer(matchingQuestion);

  console.log(
    "   Submitted Answer:",
    JSON.stringify(normalizedSubmittedMatch.data)
  );
  console.log(
    "   Correct Answer:",
    JSON.stringify(normalizedCorrectMatch.data)
  );
  console.log(
    "   Should match:",
    JSON.stringify(normalizedSubmittedMatch.data) ===
      JSON.stringify(normalizedCorrectMatch.data)
      ? "✅"
      : "❌"
  );

  // Test 7: Ordering Question with normalized answers
  console.log("\n7. Testing Ordering Question with Normalized Answers:");
  const orderingQuestion = {
    question_type: "ordering",
    points: 10,
    question_data: {
      items: [
        { id: "item1", order: 1 },
        { id: "item2", order: 2 },
        { id: "item3", order: 3 },
      ],
    },
  };

  const normalizedSubmittedOrder = AdvancedQuizGrader.normalizeAnswer(
    { ordered_item_ids: ["item1", "item2", "item3"] },
    "ordering"
  );
  const normalizedCorrectOrder =
    AdvancedQuizGrader.normalizeCorrectAnswer(orderingQuestion);

  console.log(
    "   Submitted Answer:",
    JSON.stringify(normalizedSubmittedOrder.data)
  );
  console.log(
    "   Correct Answer:",
    JSON.stringify(normalizedCorrectOrder.data)
  );
  console.log(
    "   Should match:",
    JSON.stringify(normalizedSubmittedOrder.data) ===
      JSON.stringify(normalizedCorrectOrder.data)
      ? "✅"
      : "❌"
  );

  // Test 8: Short Answer Question with normalized answers
  console.log("\n8. Testing Short Answer Question with Normalized Answers:");
  const shortAnswerQuestion = {
    question_type: "short_answer",
    points: 8,
    question_data: { correct_answer: "inheritance" },
  };

  const normalizedSubmittedSA = AdvancedQuizGrader.normalizeAnswer(
    { answer: "inheritance" },
    "short_answer"
  );
  const normalizedCorrectSA =
    AdvancedQuizGrader.normalizeCorrectAnswer(shortAnswerQuestion);

  console.log(
    "   Submitted Answer:",
    JSON.stringify(normalizedSubmittedSA.data)
  );
  console.log("   Correct Answer:", JSON.stringify(normalizedCorrectSA.data));
  console.log(
    "   Should match:",
    JSON.stringify(normalizedSubmittedSA.data) ===
      JSON.stringify(normalizedCorrectSA.data)
      ? "✅"
      : "❌"
  );

  // Test 9: Dropdown Question with normalized answers
  console.log("\n9. Testing Dropdown Question with Normalized Answers:");
  const dropdownQuestion = {
    question_type: "dropdown",
    points: 12,
    question_data: {
      dropdown_options: ["Option A", "Option B", "Option C"],
    },
    correct_answer: ["A", "B", "C"],
  };

  const normalizedSubmittedDD = AdvancedQuizGrader.normalizeAnswer(
    {
      selections: [
        { dropdown_index: 0, selected_option: "A" },
        { dropdown_index: 1, selected_option: "B" },
        { dropdown_index: 2, selected_option: "C" },
      ],
    },
    "dropdown"
  );
  const normalizedCorrectDD =
    AdvancedQuizGrader.normalizeCorrectAnswer(dropdownQuestion);

  console.log(
    "   Submitted Answer:",
    JSON.stringify(normalizedSubmittedDD.data)
  );
  console.log("   Correct Answer:", JSON.stringify(normalizedCorrectDD.data));
  console.log(
    "   Should match:",
    JSON.stringify(normalizedSubmittedDD.data) ===
      JSON.stringify(normalizedCorrectDD.data)
      ? "✅"
      : "❌"
  );

  // Test 10: Edge case - Wrong answer should not match
  console.log("\n10. Testing Edge Case - Wrong Answer Should Not Match:");
  const wrongNormalizedSubmitted = AdvancedQuizGrader.normalizeAnswer(
    { selected_answer: false },
    "true_false"
  );

  console.log(
    "   Wrong Submitted Answer:",
    JSON.stringify(wrongNormalizedSubmitted.data)
  );
  console.log("   Correct Answer:", JSON.stringify(normalizedCorrect.data));
  console.log(
    "   Should NOT match:",
    JSON.stringify(wrongNormalizedSubmitted.data) !==
      JSON.stringify(normalizedCorrect.data)
      ? "✅"
      : "❌"
  );

  // Test 11: Deep equality comparison test
  console.log("\n11. Testing Deep Equality Comparison:");
  const obj1 = { selected_answer: true };
  const obj2 = { selected_answer: true };
  const obj3 = { selected_answer: false };

  const deepEqual = (a, b) => {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    if (typeof a === "object" && typeof b === "object") {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
      }
      return true;
    }
    return false;
  };

  console.log("   obj1 === obj2:", deepEqual(obj1, obj2) ? "✅" : "❌");
  console.log("   obj1 !== obj3:", !deepEqual(obj1, obj3) ? "✅" : "❌");

  // Test 12: Complex nested object comparison
  console.log("\n12. Testing Complex Nested Object Comparison:");
  const complex1 = {
    matches: { 1: "a", 2: "b", 3: "c" },
    metadata: { time: 120 },
  };
  const complex2 = {
    matches: { 1: "a", 2: "b", 3: "c" },
    metadata: { time: 120 },
  };
  const complex3 = {
    matches: { 1: "a", 2: "b", 3: "d" },
    metadata: { time: 120 },
  };

  console.log(
    "   complex1 === complex2:",
    deepEqual(complex1, complex2) ? "✅" : "❌"
  );
  console.log(
    "   complex1 !== complex3:",
    !deepEqual(complex1, complex3) ? "✅" : "❌"
  );

  console.log("\n🎉 New Grading System Tests Completed!");
}

testNewGradingSystem().catch(console.error);
