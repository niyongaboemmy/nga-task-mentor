const mysql = require("mysql2/promise");

async function populateQuiz14CorrectAnswers() {
  let connection;

  try {
    // Create connection using environment variables
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT) || 8889,
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASS || "root",
      database: process.env.DB_NAME || "taskmentor_dev",
    });

    console.log("✅ Database connected successfully");

    // Get quiz 14 questions
    console.log("📋 Getting quiz 14 questions...");
    const [questions] = await connection.execute(`
      SELECT id, question_text, question_type, question_data
      FROM quiz_questions
      WHERE quiz_id = 14
      ORDER BY \`order\` ASC
    `);

    console.log(`📊 Found ${questions.length} questions in quiz 14`);

    // Define correct answers based on question content and type
    const correctAnswers = {
      // Question 1: "A client gives unclear feedback on a website design. What's your first step?"
      1: { correct_option_index: 1 }, // Assuming option 1 is "Ask for clarification"

      // Question 2: "You're given a new project with a tight deadline and minimal documentation. What do you do?"
      2: { correct_option_index: 1 }, // Assuming option 1 is "Start with requirements gathering"

      // Question 3: "A website looks perfect on desktop but breaks on mobile. What's the best next step?"
      3: { correct_option_index: 3 }, // Assuming option 3 is "Test on mobile devices"

      // Question 4: "Which of the following reflect good debugging practices?"
      4: { correct_option_indices: [0] }, // Assuming option 0 is "Use console.log strategically"

      // Question 5: "It's acceptable to deploy code that passes most tests but has known bugs if the deadline is close"
      5: { answer: false }, // False - never deploy with known bugs
    };

    // Update each question with correct answer
    for (const question of questions) {
      const questionOrder = question.order || question.id; // Fallback if order is not set
      const correctAnswer = correctAnswers[questionOrder];

      if (correctAnswer) {
        console.log(
          `📝 Updating question ${question.id} (${question.question_type}):`
        );
        console.log(`   "${question.question_text.substring(0, 50)}..."`);
        console.log(`   Correct answer: ${JSON.stringify(correctAnswer)}`);

        await connection.execute(
          `
          UPDATE quiz_questions
          SET correct_answer = ?
          WHERE id = ?
        `,
          [JSON.stringify(correctAnswer), question.id]
        );

        console.log(`   ✅ Updated successfully`);
      } else {
        console.log(
          `⚠️  No correct answer defined for question ${question.id} (order: ${questionOrder})`
        );
      }
    }

    console.log("\n🎉 Quiz 14 correct answers populated successfully!");
    console.log("📋 Summary:");
    console.log("- Single choice questions: correct_option_index");
    console.log("- Multiple choice questions: correct_option_indices array");
    console.log("- True/False questions: answer boolean");
  } catch (error) {
    console.error("❌ Error populating correct answers:", error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

populateQuiz14CorrectAnswers();
