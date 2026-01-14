const { QuizGrader } = require("./dist/utils/quizGrader");

// Sample quiz data - testing different correct answer formats
const sampleQuestions = [
  {
    id: 53,
    question_type: "single_choice",
    points: 10,
    question_data: {
      options: ["Option A", "Option B", "Option C", "Option D"],
      // Testing: correct answer in question_data as object
      correct_answer: { selected_option_index: 1 },
    },
    correct_answer: null, // Simulating null correct_answer column
  },
  {
    id: 54,
    question_type: "single_choice",
    points: 10,
    question_data: {
      options: ["Option A", "Option B", "Option C", "Option D"],
      // Testing: correct answer as direct number in question_data
      correct_answer: 2,
    },
    correct_answer: null,
  },
  {
    id: 55,
    question_type: "single_choice",
    points: 10,
    question_data: {
      options: ["Option A", "Option B", "Option C", "Option D"],
      // Testing: correct answer as selected_option_index in question_data
      selected_option_index: 0,
    },
    correct_answer: null,
  },
  {
    id: 56,
    question_type: "multiple_choice",
    points: 15,
    question_data: {
      options: ["Option A", "Option B", "Option C", "Option D"],
      correct_option_indices: [0, 2], // Correct answers are indices 0 and 2
    },
    correct_answer: null,
  },
  {
    id: 57,
    question_type: "true_false",
    points: 5,
    question_data: {
      // Testing: correct answer as boolean in question_data
      correct_answer: true,
    },
    correct_answer: null,
  },
];

// The submission data you provided
const submissionData = {
  quiz_id: 14,
  answers: [
    {
      question_id: 53,
      answer: {
        selected_option_index: 1,
      },
      time_taken: 7422,
    },
    {
      question_id: 54,
      answer: {
        selected_option_index: 2,
      },
      time_taken: 9780,
    },
    {
      question_id: 55,
      answer: {
        selected_option_index: 3,
      },
      time_taken: 12188,
    },
    {
      question_id: 56,
      answer: {
        selected_option_indices: [0],
      },
      time_taken: 14572,
    },
    {
      question_id: 57,
      answer: {
        selected_answer: false,
      },
      time_taken: 18508,
    },
  ],
  time_taken: 19414,
  submitted_at: "2025-11-25T22:55:09.122Z",
};

async function calculateQuizScore() {
  console.log("🧮 Calculating Quiz Score for Submission\n");

  let totalEarned = 0;
  let maxPossible = 0;
  let correctCount = 0;

  console.log("Question-by-Question Grading:\n");

  for (const answer of submissionData.answers) {
    const question = sampleQuestions.find((q) => q.id === answer.question_id);

    if (!question) {
      console.log(`❌ Question ${answer.question_id} not found`);
      continue;
    }

    const result = await QuizGrader.gradeQuestion(question, answer.answer);

    totalEarned += result.points_earned;
    maxPossible += question.points;

    if (result.is_correct) {
      correctCount++;
    }

    console.log(`Question ${question.id} (${question.question_type}):`);
    console.log(`  Student Answer: ${JSON.stringify(answer.answer)}`);
    console.log(`  Correct: ${result.is_correct ? "✅" : "❌"}`);
    console.log(`  Points: ${result.points_earned}/${question.points}`);
    console.log(`  Feedback: ${result.feedback}\n`);
  }

  const percentage = maxPossible > 0 ? (totalEarned / maxPossible) * 100 : 0;
  const passed = percentage >= 60; // Assuming 60% passing score

  console.log("📊 Final Quiz Results:");
  console.log(`Total Score: ${totalEarned}/${maxPossible} points`);
  console.log(`Percentage: ${Math.round(percentage)}%`);
  console.log(
    `Questions Correct: ${correctCount}/${submissionData.answers.length}`
  );
  console.log(`Passed: ${passed ? "✅ Yes" : "❌ No"}`);
  console.log(
    `Time Taken: ${Math.round(submissionData.time_taken / 1000)} seconds`
  );

  if (percentage === 100) {
    console.log("🎉 PERFECT SCORE!");
  } else if (passed) {
    console.log("👍 Good job!");
  } else {
    console.log("📚 Keep studying!");
  }
}

calculateQuizScore().catch(console.error);
