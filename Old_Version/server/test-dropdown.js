const mysql = require("mysql2/promise");
const { QuizGrader } = require("./dist/utils/quizGrader");

async function testDropdown() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT) || 8889,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASS || "root",
      database: process.env.DB_NAME || "taskmentor_dev",
    });

    console.log("Testing dropdown grading...\n");

    // Get the dropdown question
    const [questions] = await connection.execute(
      "SELECT * FROM quiz_questions WHERE question_type = 'dropdown' LIMIT 1"
    );

    if (questions.length === 0) {
      console.log("No dropdown question found");
      return;
    }

    const question = questions[0];
    console.log("Question:", question.question_text);
    console.log("Question data:", question.question_data);
    console.log("Correct answer:", question.correct_answer);

    // Test answer
    const testAnswer = {
      selections: [{ dropdown_index: 0, selected_option: "<a>" }],
    };

    console.log("\nTesting with answer:", JSON.stringify(testAnswer, null, 2));

    const result = await QuizGrader.gradeQuestion(question, testAnswer);
    console.log("\nResult:", result);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testDropdown();
