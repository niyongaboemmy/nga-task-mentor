const { sequelize } = require("./dist/config/database");
const { QuizSubmission, QuizAttempt, QuizQuestion } = require("./dist/models");
const { QuizGrader } = require("./dist/utils/quizGrader");

async function gradeQuiz14Submissions() {
  console.log("🎯 Grading All Submissions for Quiz ID: 14\n");

  // Initialize database connection
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection established\n");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return;
  }

  try {
    // Find all submissions for quiz 14
    const submissions = await QuizSubmission.findAll({
      where: { quiz_id: 14 },
      include: [
        {
          model: QuizAttempt,
          as: "attempts",
          include: [
            {
              model: QuizQuestion,
              as: "attemptQuestion",
            },
          ],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    if (submissions.length === 0) {
      console.log("❌ No submissions found for quiz ID 14");
      return;
    }

    console.log(`📊 Found ${submissions.length} submissions for Quiz 14\n`);

    let submissionCounter = 1;

    for (const submission of submissions) {
      console.log(`🏆 Submission #${submissionCounter} (ID: ${submission.id})`);
      console.log(`   Student ID: ${submission.student_id}`);
      console.log(`   Status: ${submission.status}`);
      console.log(
        `   Submitted: ${submission.completed_at || submission.created_at}`
      );

      const attempts = submission.attempts || [];
      console.log(`   Attempts: ${attempts.length} questions answered\n`);

      let totalEarned = 0;
      let maxPossible = 0;
      let correctCount = 0;

      // Grade each attempt
      for (const attempt of attempts) {
        if (!attempt.question) {
          console.log(
            `   ⚠️  Question ${attempt.question_id}: Question not found`
          );
          continue;
        }

        try {
          // Grade the attempt
          const gradingResult = await QuizGrader.gradeQuestion(
            attempt.question,
            attempt.submitted_answer
          );

          const pointsEarned = gradingResult.points_earned;
          const maxPoints = parseFloat(String(attempt.question.points)) || 0;

          totalEarned += pointsEarned;
          maxPossible += maxPoints;

          if (gradingResult.is_correct) {
            correctCount++;
          }

          console.log(
            `   ${gradingResult.is_correct ? "✅" : "❌"} Question ${
              attempt.question_id
            } (${attempt.question.question_type}):`
          );
          console.log(`      Points: ${pointsEarned}/${maxPoints}`);
          console.log(`      Feedback: ${gradingResult.feedback}`);

          // Update the attempt in database if needed
          if (
            attempt.points_earned !== pointsEarned ||
            attempt.is_correct !== gradingResult.is_correct
          ) {
            await attempt.update({
              points_earned: pointsEarned,
              is_correct: gradingResult.is_correct,
            });
            console.log(`      🔄 Updated in database`);
          }
        } catch (error) {
          console.log(
            `   ❌ Question ${attempt.question_id}: Grading error - ${error.message}`
          );
        }
      }

      // Calculate final score
      const percentage =
        maxPossible > 0 ? (totalEarned / maxPossible) * 100 : 0;
      const passed = percentage >= 60; // Assuming 60% passing score

      console.log(
        `\n   📈 Final Score: ${totalEarned}/${maxPossible} points (${Math.round(
          percentage
        )}%)`
      );
      console.log(`   Questions Correct: ${correctCount}/${attempts.length}`);
      console.log(`   Passed: ${passed ? "✅ Yes" : "❌ No"}`);

      // Update submission totals if needed
      if (
        submission.total_score !== totalEarned ||
        submission.max_score !== maxPossible ||
        submission.percentage !== Math.round(percentage) ||
        submission.passed !== passed
      ) {
        await submission.update({
          total_score: totalEarned,
          max_score: maxPossible,
          percentage: Math.round(percentage),
          passed: passed,
          grade_status: "auto_graded",
        });
        console.log(`   🔄 Updated submission totals in database`);
      }

      console.log(`   ──────────────────────────────────────────────────\n`);

      submissionCounter++;
    }

    // Summary
    console.log("📊 QUIZ 14 GRADING SUMMARY");
    console.log(`Total Submissions: ${submissions.length}`);

    const completedSubmissions = submissions.filter(
      (s) => s.status === "completed"
    );
    const passedSubmissions = completedSubmissions.filter((s) => s.passed);

    console.log(`Completed Submissions: ${completedSubmissions.length}`);
    console.log(`Passed Submissions: ${passedSubmissions.length}`);
    console.log(
      `Pass Rate: ${
        completedSubmissions.length > 0
          ? Math.round(
              (passedSubmissions.length / completedSubmissions.length) * 100
            )
          : 0
      }%`
    );

    if (completedSubmissions.length > 0) {
      const avgScore =
        completedSubmissions.reduce((sum, s) => sum + s.percentage, 0) /
        completedSubmissions.length;
      console.log(`Average Score: ${Math.round(avgScore)}%`);
    }
  } catch (error) {
    console.error("❌ Error grading quiz submissions:", error);
  }
}

// Run the grading
gradeQuiz14Submissions().catch(console.error);
